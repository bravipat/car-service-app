import { NextRequest, NextResponse } from "next/server";
import { nhtsaFetch, parseVehicle, resultsOf, resolveModelName, clip } from "@/lib/nhtsa";

async function query(year: number, make: string, model: string) {
  const data = await nhtsaFetch(
    `/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
      model
    )}&modelYear=${year}`
  );
  return resultsOf(data);
}

export async function GET(req: NextRequest) {
  const v = parseVehicle(req);
  if (!v) return NextResponse.json({ error: "year, make and model are required" }, { status: 400 });

  try {
    let rows = await query(v.year, v.make, v.model);
    if (rows.length === 0) {
      const alt = await resolveModelName(v, "r");
      if (alt !== v.model) rows = await query(v.year, v.make, alt);
    }

    const recalls = rows.map((r) => ({
      campaign: r.NHTSACampaignNumber,
      reportDate: r.ReportReceivedDate, // NHTSA formats this DD/MM/YYYY
      component: clip(r.Component, 120),
      summary: clip(r.Summary, 500),
      consequence: clip(r.Consequence, 400),
      remedy: clip(r.Remedy, 400),
      parkIt: !!r.parkIt,
      parkOutSide: !!r.parkOutSide,
      overTheAir: !!r.overTheAirUpdate,
    }));
    return NextResponse.json({ recalls });
  } catch (err) {
    console.error("GET /api/nhtsa/recalls failed:", err);
    return NextResponse.json({ error: "Could not reach NHTSA recalls" }, { status: 502 });
  }
}
