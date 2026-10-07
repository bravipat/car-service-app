import { getPool } from "./db";
import { ensureSchema } from "./schema";

// Keyword search over the reference documents (Postgres full-text search).
// The question is turned into an OR query, so a chunk only needs to match some
// of the words; ts_rank_cd then favours chunks matching more of them.

const STOP = new Set(
  ("a an and are as at be but by can could do does for from had has have how i if in is it its me my of on or should so " +
    "than that the their then there these they this to was we were what when where which who why will with would you your " +
    "about into over under tell please explain").split(" ")
);

// The corpus says "alcohol and other impairing drugs"; people ask about "drunk driving".
const SYNONYMS: Record<string, string[]> = {
  drunk: ["alcohol", "impaired"],
  dui: ["alcohol", "impaired"],
  dwi: ["alcohol", "impaired"],
  intoxicated: ["alcohol", "impaired"],
  drinking: ["alcohol"],
  booze: ["alcohol"],
  seatbelt: ["safety", "belt"],
  seatbelts: ["safety", "belt"],
  biking: ["bicycle"],
  biker: ["bicycle", "bicyclist"],
  cyclist: ["bicycle", "bicyclist"],
  walking: ["pedestrian"],
  elderly: ["older", "driver"],
  senior: ["older", "driver"],
  seniors: ["older", "driver"],
  construction: ["work", "zone"],
  roadwork: ["work", "zone"],
  blindspot: ["blindzone"],
  "blind-spot": ["blindzone"],
  mirrors: ["mirror"],
  wheel: ["steering"],
  distracted: ["perception", "attention"],
};

export function toTsQuery(question: string): string | null {
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
  const expanded = new Set<string>();
  for (const t of tokens) {
    for (const piece of [t, ...(SYNONYMS[t] ?? [])]) {
      const clean = piece.replace(/[^a-z0-9]/g, "");
      if (clean.length >= 2) expanded.add(clean);
    }
  }
  const terms = [...expanded].slice(0, 16);
  return terms.length ? terms.join(" | ") : null;
}

export type KbHit = {
  docId: string;
  docTitle: string;
  sourceUrl: string | null;
  sectionPath: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  rank: number;
};

export async function searchKnowledge(question: string, limit = 5): Promise<KbHit[]> {
  const q = toTsQuery(question);
  if (!q) return [];
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT doc_id, doc_title, source_url, section_path, page_start, page_end, content,
            ts_rank_cd(tsv, query, 32) AS rank
       FROM kb_chunks, to_tsquery('english', $1) query
      WHERE tsv @@ query
      ORDER BY rank DESC, doc_id, chunk_index
      LIMIT $2`,
    [q, limit]
  );
  return rows.map((r) => ({
    docId: r.doc_id,
    docTitle: r.doc_title,
    sourceUrl: r.source_url,
    sectionPath: r.section_path,
    pageStart: r.page_start,
    pageEnd: r.page_end,
    content: r.content,
    rank: Number(r.rank),
  }));
}

/** "Page 2" / "Pages 2–3" */
export function pageLabel(h: Pick<KbHit, "pageStart" | "pageEnd">): string {
  if (!h.pageStart) return "";
  return h.pageEnd && h.pageEnd !== h.pageStart ? `pp. ${h.pageStart}–${h.pageEnd}` : `p. ${h.pageStart}`;
}
