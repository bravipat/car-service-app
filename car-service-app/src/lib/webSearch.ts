// Free web lookup used only when the reference documents don't answer the question.
//
//  1. Tavily (https://tavily.com) when TAVILY_API_KEY is set — its free plan needs no
//     credit card (check their current monthly allowance). Good general web results.
//  2. Otherwise Wikipedia's public API — no key, no cost, but encyclopedic coverage only.
//
// Anthropic's built-in web-search tool is deliberately NOT used: it is billed per search.

export type WebResult = { title: string; url: string; content: string };

const UA = "car-service-reminder-app/1.0 (contact: set-your-email-here)";

async function tavily(query: string, key: string): Promise<WebResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 4, search_depth: "basic", include_answer: false }),
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data.results) ? data.results : [])
    .filter((r: any) => typeof r.url === "string" && r.url.startsWith("http"))
    .map((r: any) => ({
      title: String(r.title || r.url).slice(0, 160),
      url: r.url,
      content: String(r.content || "").slice(0, 1500),
    }));
}

async function wikipedia(query: string): Promise<WebResult[]> {
  const base = "https://en.wikipedia.org/w/api.php";
  const headers = { "User-Agent": UA, Accept: "application/json" };
  const s = await fetch(
    `${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json`,
    { headers, signal: AbortSignal.timeout(9000) }
  );
  if (!s.ok) throw new Error(`Wikipedia ${s.status}`);
  const hits: { pageid: number; title: string }[] = (await s.json())?.query?.search ?? [];
  if (!hits.length) return [];

  const ids = hits.map((h) => h.pageid).join("|");
  const e = await fetch(
    `${base}?action=query&prop=extracts&exintro=1&explaintext=1&exchars=1500&pageids=${ids}&format=json`,
    { headers, signal: AbortSignal.timeout(9000) }
  );
  if (!e.ok) throw new Error(`Wikipedia ${e.status}`);
  const pages = (await e.json())?.query?.pages ?? {};
  return hits
    .map((h) => ({
      title: `${h.title} (Wikipedia)`,
      url: `https://en.wikipedia.org/?curid=${h.pageid}`,
      content: String(pages[h.pageid]?.extract || ""),
    }))
    .filter((r) => r.content.length > 80);
}

export async function webSearch(query: string): Promise<WebResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (key) {
    try {
      const r = await tavily(query, key);
      if (r.length) return r;
    } catch (err) {
      console.error("Tavily search failed, falling back to Wikipedia:", err);
    }
  }
  try {
    return await wikipedia(query);
  } catch (err) {
    console.error("Wikipedia search failed:", err);
    return [];
  }
}

// Best-effort guard so a burst of questions can't burn through a free search quota.
// (In-memory, so it is per server instance — a speed bump, not a hard limit.)
const hits = new Map<string, number[]>();
export function allowWebSearch(clientKey: string, max = 6, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(clientKey) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(clientKey, recent);
    return false;
  }
  recent.push(now);
  hits.set(clientKey, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
