#!/usr/bin/env python3
"""
Turns reference PDFs into search-ready chunks (db/knowledge/chunks.json).

Chunking pattern
  1. Read each PDF with poppler's `pdftohtml -xml`, which keeps font size and
     bold flags, and rebuild lines -> paragraphs (bullets stay separate).
  2. Detect headings from typography (bold / larger than body text, short, no
     sentence punctuation) and keep a heading trail per section.
  3. A section that fits the size budget becomes ONE chunk. A longer one is
     packed paragraph by paragraph; a paragraph longer than the budget is split
     at sentence boundaries. Chunks never end mid-sentence.
  4. When a section is split, each following chunk repeats the last sentence(s)
     of the previous one (~12% of the budget) so context isn't lost at the seam.
  5. Every chunk carries: document title, section path, page range, source URL.

Requires poppler-utils (`pdftohtml`). Usage:
  python3 scripts/build-knowledge.py <pdf-folder> [--meta docs-meta.json] [--out db/knowledge/chunks.json]

docs-meta.json (optional) maps a file name to {"title": "...", "url": "..."}.
"""
import json, os, re, subprocess, sys, tempfile
import xml.etree.ElementTree as ET
from collections import Counter

TARGET_WORDS = 200        # soft budget per chunk (~270 tokens)
MAX_WORDS = 300          # a section up to this size stays a single chunk
OVERLAP_RATIO = 0.12      # share of the budget repeated at a split seam
BULLET_RE = re.compile(r"^[\s ]*([■•●▪◦○□•■*\-–—]+)[\s ]*")
PAGE_NOISE_RE = re.compile(
    r"^(page\s+\d+\s*(of\s*\d+)?|\d+"
    r"|National Highway Traffic Safety Administration\s*\d*"
    r"|\d{4,5}[a-z]?-\d+-v\d+\w*.*DOT HS.*)$", re.I)
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])[\"')\]]*\s+(?=[A-Z0-9“\"(])")


def run_pdftohtml(pdf):
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "o")
        subprocess.run(["pdftohtml", "-xml", "-i", "-q", "-noframes", pdf, out],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return ET.parse(out + ".xml").getroot()


def clean(s):
    s = s.replace(" ", " ")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def read_lines(root):
    """-> list of dicts: page, top, height, size, bold, text (in stream order)."""
    lines = []
    # Font ids are global to the PDF (page 2 may use fonts declared on page 1).
    fonts = {}
    for fs in root.iter("fontspec"):
        fam = fs.get("family", "").lower()
        fonts[fs.get("id")] = (float(fs.get("size")), any(k in fam for k in ("bold", "black", "heavy", "semibold")))
    for page in root.iter("page"):
        pno = int(page.get("number"))
        cur = None
        for t in page.iter("text"):
            txt = "".join(t.itertext())
            if not txt.strip():
                continue
            size, bold = fonts.get(t.get("font"), (12, False))
            top, h = int(t.get("top")), int(t.get("height"))
            if cur and abs(top - cur["top"]) <= 3 and cur["page"] == pno:
                cur["text"] += txt
                cur["chars"] += len(txt.strip())
                cur["bold_chars"] += len(txt.strip()) if bold else 0
                cur["size"] = max(cur["size"], size)
            else:
                if cur:
                    lines.append(cur)
                cur = dict(page=pno, top=top, height=h, size=size, text=txt,
                           chars=len(txt.strip()), bold_chars=len(txt.strip()) if bold else 0)
        if cur:
            lines.append(cur)
    for l in lines:
        l["text"] = clean(l["text"])
        l["bold"] = l["chars"] > 0 and l["bold_chars"] / l["chars"] > 0.8
    return [l for l in lines if l["text"]]


def body_size(lines):
    c = Counter()
    for l in lines:
        c[l["size"]] += len(l["text"])
    return c.most_common(1)[0][0]


def is_heading(l, body):
    t = l["text"]
    if len(t) > 80 or len(t) < 3 or len(t.split()) > 11 or not re.search(r"[A-Za-z]{3}", t):
        return False
    if not re.match(r"^[A-Z0-9(“\"]", t):          # wrapped sentence continuations start lowercase
        return False
    if re.search(r"\s[–-]\s\w", t) and not t.endswith(":"):  # "Judgment – Judgment is…" lead-in sentence
        return False
    if BULLET_RE.match(t):
        return False
    if t.endswith((".", ",", ";", "!")) and not re.match(r"^[IVX]+\.\s", t):
        return False
    if re.search(r"[.!?]\s+[A-Z]", t) and not re.match(r"^[IVX]+\.\s", t):  # sentence + more text = bullet lead-in
        return False
    bigger = l["size"] >= body * 1.15
    return (l["bold"] or bigger)


def heading_level(l, body):
    t = l["text"]
    if l["size"] >= body * 1.3 or re.match(r"^[IVX]+\.\s", t) or (t.isupper() and len(t) > 6):
        return 1
    return 2


def build_blocks(lines):
    """-> list of ('heading', level, text, page) / ('para', text, page)."""
    body = body_size(lines)
    pages = max(l["page"] for l in lines)

    # Title = largest text on the first page (before we strip repeated headers).
    first = [l for l in lines if l["page"] == 1]
    big = max(first, key=lambda l: (l["size"], -l["top"])) if first else None
    title = big["text"] if big and big["size"] >= body * 1.3 else None

    # Drop page furniture: "Page 1 of 2", bare numbers, lines repeated on every page.
    seen = Counter(l["text"] for l in lines)
    lines = [l for l in lines
             if not PAGE_NOISE_RE.match(l["text"])
             and not (pages > 1 and seen[l["text"]] >= pages and len(l["text"]) < 80)]

    blocks, buf, buf_page, prev = [], [], None, None

    def flush():
        nonlocal buf, buf_page
        if buf:
            text = clean(" ".join(buf))
            text = re.sub(r"(\w)- (\w)", r"\1\2", text) if False else text
            blocks.append(("para", text, buf_page))
        buf, buf_page = [], None

    ROMAN_INLINE = re.compile(r"^([IVX]+\.\s+[A-Z][A-Z0-9 ,&/'\-]*[A-Z0-9])\s+(?=[A-Z][a-z])(.+)$")
    expanded = []
    for l in lines:
        m = ROMAN_INLINE.match(l["text"])
        if m:
            expanded.append({**l, "text": m.group(1), "bold": True})
            expanded.append({**l, "text": m.group(2), "bold": False, "top": l["top"] + 1})
        else:
            expanded.append(l)
    lines = expanded

    for l in lines:
        t = l["text"]
        if title and t == title and l["page"] == 1:
            prev = l
            continue
        gap_break = prev is not None and prev["page"] == l["page"] and (l["top"] - prev["top"]) > prev["height"] * 1.7
        if is_heading(l, body):
            flush()
            blocks.append(("heading", heading_level(l, body), t, l["page"]))
        elif BULLET_RE.match(t):
            flush()
            buf, buf_page = [BULLET_RE.sub("", t)], l["page"]
        else:
            if gap_break:
                flush()
            if not buf:
                buf_page = l["page"]
            buf.append(t)
        prev = l
    flush()
    return title, blocks


def words(s):
    return len(s.split())


def split_sentences(p):
    parts = SENT_SPLIT_RE.split(p)
    return [x.strip() for x in parts if x.strip()]


def tail_sentences(text, budget_words):
    """Whole trailing sentence(s) worth about `budget_words` (never mid-sentence).
    Returns "" when even the last sentence is far bigger than the budget (e.g. a long
    bullet with no sentence breaks) — repeating it would bloat the next chunk."""
    sents, out, n = split_sentences(text), [], 0
    for s in reversed(sents):
        w = words(s)
        if n + w > budget_words * 2:
            break
        out.insert(0, s)
        n += w
        if n >= budget_words:
            break
    return " ".join(out)


def chunk_section(paras):
    """paras: [(text, page)] -> [(text, page_start, page_end)]"""
    total = sum(words(p) for p, _ in paras)
    if total <= MAX_WORDS:
        return [("\n\n".join(p for p, _ in paras), paras[0][1], paras[-1][1])]

    # Explode over-long paragraphs into sentence units first.
    units = []
    for p, pg in paras:
        if words(p) > TARGET_WORDS:
            cur = []
            for s in split_sentences(p):
                if cur and words(" ".join(cur + [s])) > TARGET_WORDS:
                    units.append((" ".join(cur), pg)); cur = []
                cur.append(s)
            if cur:
                units.append((" ".join(cur), pg))
        else:
            units.append((p, pg))

    chunks, cur, cur_w, overlap_budget = [], [], 0, max(1, int(TARGET_WORDS * OVERLAP_RATIO))
    for text, pg in units:
        w = words(text)
        if cur and cur_w + w > TARGET_WORDS:
            body = "\n\n".join(t for t, _ in cur)
            chunks.append((body, cur[0][1], cur[-1][1]))
            seed = tail_sentences(cur[-1][0], overlap_budget)
            cur, cur_w = ([(seed, cur[-1][1])], words(seed)) if seed else ([], 0)
        cur.append((text, pg))
        cur_w += w
    if cur and (len(chunks) == 0 or cur_w > words(cur[0][0])):
        chunks.append(("\n\n".join(t for t, _ in cur), cur[0][1], cur[-1][1]))
    return chunks


def process(pdf, meta):
    lines = read_lines(run_pdftohtml(pdf))
    if not lines:
        raise SystemExit(f"No extractable text in {pdf} (scanned PDF? OCR it first).")
    title, blocks = build_blocks(lines)
    base = os.path.basename(pdf)
    m = meta.get(base, {})
    doc_title = m.get("title") or title or os.path.splitext(base)[0]
    doc_id = os.path.splitext(base)[0]

    sections, h1, h2 = [], None, None
    cur = {"path": [doc_title], "paras": []}
    for b in blocks:
        if b[0] == "heading":
            if cur["paras"]:
                sections.append(cur)
            _, level, text, _pg = b
            if level == 1:
                h1, h2 = text, None
            else:
                h2 = text
            cur = {"path": [doc_title] + [x for x in (h1, h2) if x], "paras": []}
        else:
            cur["paras"].append((b[1], b[2]))
    if cur["paras"]:
        sections.append(cur)

    out, idx = [], 0
    for s in sections:
        for text, p0, p1 in chunk_section(s["paras"]):
            if words(text) < 6:          # cover-page fragments etc.
                continue
            out.append(dict(docId=doc_id, docTitle=doc_title, sourceUrl=m.get("url"),
                            sectionPath=" > ".join(s["path"]), pageStart=p0, pageEnd=p1,
                            chunkIndex=idx, content=text, wordCount=words(text)))
            idx += 1
    return out


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith("--"):
        sys.exit(__doc__)
    folder = args[0]
    meta_path = args[args.index("--meta") + 1] if "--meta" in args else os.path.join(folder, "docs-meta.json")
    out_path = args[args.index("--out") + 1] if "--out" in args else "db/knowledge/chunks.json"
    meta = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}

    all_chunks = []
    for f in sorted(os.listdir(folder)):
        if f.lower().endswith(".pdf"):
            cs = process(os.path.join(folder, f), meta)
            print(f"{f}: {len(cs)} chunks, {sum(c['wordCount'] for c in cs)} words")
            all_chunks += cs
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    json.dump(all_chunks, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {len(all_chunks)} chunks -> {out_path}")


if __name__ == "__main__":
    main()
