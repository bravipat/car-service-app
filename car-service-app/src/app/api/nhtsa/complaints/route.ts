import { NextRequest, NextResponse } from "next/server";
import { nhtsaFetch, parseVehicle, resultsOf, resolveModelName, clip } from "@/lib/nhtsa";

async function query(year: number, make: string, model: string) {
  const data = await nhtsaFetch(
    `/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
      model
    )}&modelYear=${year}`
  );
  return resultsOf(data);
}

const ts = (s: unknown) => {
  const t = typeof s === "string" ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : 0;
};

export async function GET(req: NextRequest) {
  const v = parseVehicle(req);
  if (!v) return NextResponse.json({ error: "year, make and model are required" }, { status: 400 });

  try {
    let rows = await query(v.year, v.make, v.model);
    if (rows.length === 0) {
      const alt = await resolveModelName(v, "c");
      if (alt !== v.model) rows = await query(v.year, v.make, alt);
    }

    const byComponent = new Map<string, number>();
    let crashes = 0, fires = 0, injuries = 0, deaths = 0;
    for (const r of rows) {
      if (r.crash) crashes++;
      if (r.fire) fires++;
      injuries += Number(r.numberOfInjuries) || 0;
      deaths += Number(r.numberOfDeaths) || 0;
      String(r.components || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => byComponent.set(c, (byComponent.get(c) || 0) + 1));
    }

    const topComponents = [...byComponent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([component, count]) => ({ component, count }));

    const recent = [...rows]
      .sort((a, b) => ts(b.dateComplaintFiled) - ts(a.dateComplaintFiled))
      .slice(0, 8)
      .map((r) => ({
        odiNumber: r.odiNumber,
        filed: r.dateComplaintFiled,
        components: clip(r.components, 120),
        summary: clip(r.summary, 400),
        crash: !!r.crash,
        fire: !!r.fire,
        injuries: Number(r.numberOfInjuries) || 0,
        deaths: Number(r.numberOfDeaths) || 0,
      }));

    return NextResponse.json({
      total: rows.length,
      crashes,
      fires,
      injuries,
      deaths,
      topComponents,
      recent,
    });
  } catch (err) {
    console.error("GET /api/nhtsa/complaints failed:", err);
    return NextResponse.json({ error: "Could not reach NHTSA complaints" }, { status: 502 });
  }
}
