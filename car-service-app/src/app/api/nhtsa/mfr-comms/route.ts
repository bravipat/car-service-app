import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { parseVehicle, norm } from "@/lib/nhtsa";

// Manufacturer communications (technical service bulletins). NHTSA publishes
// these only as bulk flat files, not an API, so they are loaded into our own
// table by scripts/load-mfr-comms.mjs and queried from there.
export async function GET(req: NextRequest) {
  const v = parseVehicle(req);
  if (!v) return NextResponse.json({ error: "year, make and model are required" }, { status: 400 });

  try {
    await ensureSchema();
    const pool = getPool();

    const { rows: stat } = await pool.query("SELECT count(*)::int AS n FROM nhtsa_mfr_comms");
    if (stat[0].n === 0) {
      return NextResponse.json({ loaded: false, items: [] });
    }

    // Our model names can be longer/shorter than NHTSA's, so match loosely on
    // make (exact, ignoring punctuation) and model (either contains the other).
    const { rows } = await pool.query(
      `SELECT bulletin_no, component, summary, to_char(bulletin_date,'YYYY-MM-DD') AS bulletin_date, model
         FROM nhtsa_mfr_comms
        WHERE model_year = $1
          AND regexp_replace(UPPER(make), '[^A-Z0-9]', '', 'g') = $2
          AND ( regexp_replace(UPPER(model), '[^A-Z0-9]', '', 'g') LIKE '%' || $3 || '%'
             OR $3 LIKE '%' || regexp_replace(UPPER(model), '[^A-Z0-9]', '', 'g') || '%' )
        ORDER BY bulletin_date DESC NULLS LAST
        LIMIT 50`,
      [v.year, norm(v.make), norm(v.model)]
    );

    return NextResponse.json({
      loaded: true,
      items: rows.map((r) => ({
        bulletin: r.bulletin_no,
        component: r.component,
        summary: r.summary,
        date: r.bulletin_date,
        model: r.model,
      })),
    });
  } catch (err) {
    console.error("GET /api/nhtsa/mfr-comms failed:", err);
    return NextResponse.json({ error: "Could not load manufacturer communications" }, { status: 500 });
  }
}
