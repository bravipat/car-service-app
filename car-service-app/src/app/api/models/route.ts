import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const makeId = req.nextUrl.searchParams.get("makeId");
  if (!makeId) {
    return NextResponse.json(
      { error: "makeId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT model_id, name
       FROM models
       WHERE make_id = $1
       ORDER BY name ASC`,
      [makeId]
    );
    return NextResponse.json(
      rows.map((r) => ({ id: r.model_id, name: r.name }))
    );
  } catch (err) {
    console.error("GET /api/models failed:", err);
    return NextResponse.json(
      { error: "Failed to load models" },
      { status: 500 }
    );
  }
}
