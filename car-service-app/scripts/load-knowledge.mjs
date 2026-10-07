#!/usr/bin/env node
// Loads db/knowledge/chunks.json (built by scripts/build-knowledge.py) into the
// kb_chunks table. Each document is replaced wholesale, so re-running after you
// add or edit documents is safe.
//
//   node --env-file=.env.local scripts/load-knowledge.mjs [chunks.json] [--dry-run]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--")) ?? "db/knowledge/chunks.json";

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}
const chunks = JSON.parse(fs.readFileSync(file, "utf8"));
const byDoc = new Map();
for (const c of chunks) {
  if (!c.docId || !c.docTitle || !c.sectionPath || !c.content) throw new Error(`Bad chunk: ${JSON.stringify(c).slice(0, 120)}`);
  if (!byDoc.has(c.docId)) byDoc.set(c.docId, []);
  byDoc.get(c.docId).push(c);
}

if (dryRun) {
  for (const [id, cs] of byDoc) console.log(`${id}: ${cs.length} chunks`);
  console.log(`[dry run] ${chunks.length} chunks in ${byDoc.size} documents; database not touched`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/load-knowledge.mjs");
  process.exit(1);
}

const { default: pg } = await import("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
const here = path.dirname(fileURLToPath(import.meta.url));
const client = await pool.connect();
try {
  await client.query(fs.readFileSync(path.join(here, "..", "db", "schema.sql"), "utf8"));
  await client.query("BEGIN");
  for (const [docId, cs] of byDoc) {
    await client.query("DELETE FROM kb_chunks WHERE doc_id = $1", [docId]);
    for (const c of cs) {
      await client.query(
        `INSERT INTO kb_chunks (doc_id, doc_title, source_url, section_path, page_start, page_end, chunk_index, content)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [c.docId, c.docTitle, c.sourceUrl ?? null, c.sectionPath, c.pageStart ?? null, c.pageEnd ?? null, c.chunkIndex, c.content]
      );
    }
    console.log(`${docId}: ${cs.length} chunks`);
  }
  await client.query("COMMIT");
  const { rows } = await client.query("SELECT count(*)::int AS n FROM kb_chunks");
  console.log(`done — kb_chunks now holds ${rows[0].n} chunks`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
