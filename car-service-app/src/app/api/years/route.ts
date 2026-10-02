import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId");
  if (!modelId) {
    return NextResponse.json(
      { error: "modelId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT year
       FROM model_years
       WHERE model_id = $1
       ORDER BY year DESC`,
      [modelId]
    );
    return NextResponse.json(rows.map((r) => r.year));
  } catch (err) {
    console.error("GET /api/years failed:", err);
    return NextResponse.json(
      { error: "Failed to load years" },
      { status: 500 }
    );
  }
}
