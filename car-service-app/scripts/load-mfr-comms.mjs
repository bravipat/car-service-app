#!/usr/bin/env node
// Loads NHTSA "Manufacturer Communications" (technical service bulletins)
// from their bulk tab-delimited flat file into the nhtsa_mfr_comms table.
//
// NHTSA publishes this data only as a download (no API):
//   https://www.nhtsa.gov/nhtsa-datasets-and-apis  → Manufacturer Communications
//
// Usage (from the project root, after `npm install`):
//   1. Download and unzip the flat file from the page above.
//   2. node --env-file=.env.local scripts/load-mfr-comms.mjs path/to/file.txt
//
// Options:
//   --dry-run            parse and report only; do not touch the database
//   --cols=a:0,b:1,...   map columns by position when the file has no header
//                        row. Names: bulletin,make,model,year,component,summary,date
//
// Re-running is safe: duplicates are skipped.

import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALIASES = {
  bulletin: ["BULLETIN_NO", "BULLETINNO", "BULLETIN_NUMBER", "TSBNO", "TSB_NO", "NHTSA_ITEM_NUMBER", "NHTSAITEMNUMBER", "ITEMNUM", "ITEM_NUMBER"],
  make: ["MAKETXT", "MAKE", "MAKE_NAME"],
  model: ["MODELTXT", "MODEL", "MODEL_NAME"],
  year: ["YEARTXT", "YEAR", "MODELYEAR", "MODEL_YEAR"],
  component: ["COMPNAME", "COMPONENT", "COMPONENT_DESCRIPTION", "COMPONENTDESCRIPTION"],
  summary: ["SUMMARY", "SUMMARY_TEXT", "DESCRIPTION", "SUBJECT"],
  date: ["DATEA", "BULLETIN_DATE", "DATE", "DATE_ADDED", "DATEADDED"],
};
const REQUIRED = ["bulletin", "make", "model", "year"];

export function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/); // YYYYMMDD
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

/** Map our field names to column indexes from a header row. */
export function mapHeader(cells) {
  const upper = cells.map((c) => c.trim().toUpperCase().replace(/\s+/g, "_"));
  const map = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const idx = upper.findIndex((c) => names.includes(c));
    if (idx >= 0) map[field] = idx;
  }
  return REQUIRED.every((f) => f in map) ? map : null;
}

export function parseColsArg(arg) {
  const map = {};
  for (const part of arg.split(",")) {
    const [name, idx] = part.split(":");
    if (!(name in ALIASES) || !/^\d+$/.test(idx || "")) throw new Error(`Bad --cols entry: "${part}"`);
    map[name] = Number(idx);
  }
  if (!REQUIRED.every((f) => f in map)) throw new Error(`--cols must include: ${REQUIRED.join(", ")}`);
  return map;
}

export function rowFromCells(cells, map) {
  const get = (f) => (f in map ? (cells[map[f]] ?? "").trim() : "");
  const year = Number(get("year"));
  const bulletin = get("bulletin");
  const make = get("make");
  const model = get("model");
  if (!bulletin || !make || !model) return null;
  if (!Number.isInteger(year) || year < 1950 || year > 2100) return null; // 9999 etc. = not applicable
  return {
    bulletin_no: bulletin,
    make,
    model,
    model_year: year,
    component: get("component") || null,
    summary: get("summary") || null,
    bulletin_date: parseDate(get("date")),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const colsArg = args.find((a) => a.startsWith("--cols="));

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/load-mfr-comms.mjs <file.txt> [--dry-run] [--cols=...]");
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  if (!dryRun && !process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/load-mfr-comms.mjs <file>");
    process.exit(1);
  }

  let pool = null;
  if (!dryRun) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
    const here = path.dirname(fileURLToPath(import.meta.url));
    await pool.query(fs.readFileSync(path.join(here, "..", "db", "schema.sql"), "utf8"));
  }

  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "latin1" }), crlfDelay: Infinity });

  let map = colsArg ? parseColsArg(colsArg.slice("--cols=".length)) : null;
  let first = true;
  let seen = 0, skipped = 0, inserted = 0;
  let batch = [];
  const samples = [];

  async function flush() {
    if (!batch.length) return;
    if (pool) {
      const values = [];
      const params = [];
      batch.forEach((r, i) => {
        const o = i * 7;
        values.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7})`);
        params.push(r.bulletin_no, r.make, r.model, r.model_year, r.component, r.summary, r.bulletin_date);
      });
      const res = await pool.query(
        `INSERT INTO nhtsa_mfr_comms (bulletin_no, make, model, model_year, component, summary, bulletin_date)
         VALUES ${values.join(",")} ON CONFLICT (bulletin_no, make, model, model_year) DO NOTHING`,
        params
      );
      inserted += res.rowCount ?? 0;
    } else {
      inserted += batch.length;
    }
    batch = [];
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = line.split("\t");

    if (first) {
      first = false;
      if (!map) {
        map = mapHeader(cells);
        if (map) continue; // that was the header row
        console.error("Could not find a header row with bulletin/make/model/year columns.");
        console.error("First row had", cells.length, "columns:", cells.slice(0, 12).map((c) => c.slice(0, 30)));
        console.error("Re-run with --cols=bulletin:0,make:1,model:2,year:3[,component:4,summary:5,date:6] matching the file's layout.");
        process.exit(1);
      }
    }

    seen++;
    const row = rowFromCells(cells, map);
    if (!row) {
      skipped++;
      continue;
    }
    if (samples.length < 3) samples.push(row);
    batch.push(row);
    if (batch.length >= 500) await flush();
  }
  await flush();
  if (pool) await pool.end();

  console.log(`${dryRun ? "[dry run] " : ""}rows read: ${seen}, skipped: ${skipped}, ${dryRun ? "would insert" : "inserted (new)"}: ${inserted}`);
  if (dryRun) console.log("sample:", JSON.stringify(samples, null, 2));
}

// Run only when executed directly (lets the parsing helpers be imported in tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
