import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT make_id, name, display_name
       FROM makes
       ORDER BY COALESCE(display_name, name) ASC`
    );
    return NextResponse.json(
      rows.map((r) => ({
        id: r.make_id,
        name: r.display_name ?? r.name,
      }))
    );
  } catch (err) {
    console.error("GET /api/makes failed:", err);
    return NextResponse.json(
      { error: "Failed to load makes" },
      { status: 500 }
    );
  }
}
