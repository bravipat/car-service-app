import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

// Save a vehicle search for an anonymous browser id.
export async function POST(req: NextRequest) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ok =
    typeof b.clientId === "string" && UUID_RE.test(b.clientId) &&
    isInt(b.makeId) && isInt(b.modelId) && isInt(b.year) &&
    b.year >= 1950 && b.year <= 2100 &&
    typeof b.makeName === "string" && b.makeName.length > 0 && b.makeName.length <= 80 &&
    typeof b.modelName === "string" && b.modelName.length > 0 && b.modelName.length <= 120 &&
    isInt(b.mileage) && b.mileage >= 0 && b.mileage < 2_000_000 &&
    typeof b.zip === "string" && /^\d{5}$/.test(b.zip) &&
    (b.lastServiceDate == null || /^\d{4}-\d{2}-\d{2}$/.test(b.lastServiceDate));

  if (!ok) return NextResponse.json({ error: "Invalid vehicle data" }, { status: 400 });

  try {
    await ensureSchema();
    await getPool().query(
      `INSERT INTO vehicle_searches
         (client_id, make_id, model_id, make_name, model_name, model_year, mileage, zip, last_service_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [b.clientId, b.makeId, b.modelId, b.makeName, b.modelName, b.year, b.mileage, b.zip, b.lastServiceDate ?? null]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/searches failed:", err);
    return NextResponse.json({ error: "Could not save vehicle" }, { status: 500 });
  }
}

// Most recent distinct vehicles for this browser id.
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  try {
    await ensureSchema();
    const { rows } = await getPool().query(
      `SELECT * FROM (
         SELECT DISTINCT ON (make_id, model_id, model_year)
                make_id, model_id, make_name, model_name, model_year, mileage, zip,
                to_char(last_service_date, 'YYYY-MM-DD') AS last_service_date, created_at
         FROM vehicle_searches
         WHERE client_id = $1
         ORDER BY make_id, model_id, model_year, created_at DESC
       ) t ORDER BY created_at DESC LIMIT 5`,
      [clientId]
    );
    return NextResponse.json({
      vehicles: rows.map((r) => ({
        makeId: r.make_id,
        modelId: r.model_id,
        makeName: r.make_name,
        modelName: r.model_name,
        year: r.model_year,
        mileage: r.mileage,
        zip: String(r.zip).trim(),
        lastServiceDate: r.last_service_date ?? "",
      })),
    });
  } catch (err) {
    console.error("GET /api/searches failed:", err);
    return NextResponse.json({ error: "Could not load saved vehicles" }, { status: 500 });
  }
}

// Delete saved searches for this browser id: one vehicle (makeId + modelId + year),
// or every search when only clientId is given.
export async function DELETE(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const clientId = q.get("clientId") || "";
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const hasVehicle = q.has("makeId") || q.has("modelId") || q.has("year");
  const makeId = Number(q.get("makeId"));
  const modelId = Number(q.get("modelId"));
  const year = Number(q.get("year"));
  if (hasVehicle && !(q.has("makeId") && q.has("modelId") && q.has("year") && isInt(makeId) && isInt(modelId) && isInt(year))) {
    return NextResponse.json({ error: "makeId, modelId and year must all be whole numbers" }, { status: 400 });
  }

  try {
    await ensureSchema();
    const res = hasVehicle
      ? await getPool().query(
          `DELETE FROM vehicle_searches
           WHERE client_id = $1 AND make_id = $2 AND model_id = $3 AND model_year = $4`,
          [clientId, makeId, modelId, year]
        )
      : await getPool().query(`DELETE FROM vehicle_searches WHERE client_id = $1`, [clientId]);
    return NextResponse.json({ ok: true, deleted: res.rowCount ?? 0 });
  } catch (err) {
    console.error("DELETE /api/searches failed:", err);
    return NextResponse.json({ error: "Could not delete searches" }, { status: 500 });
  }
}
