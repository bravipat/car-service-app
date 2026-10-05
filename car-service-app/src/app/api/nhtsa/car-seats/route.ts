import { NextRequest, NextResponse } from "next/server";
import { nhtsaFetch, resultsOf } from "@/lib/nhtsa";
import { geocodeZip, haversineMiles } from "@/lib/geo";

// Child car seat inspection stations near a zip, from NHTSA's CSSI locator.
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "A valid 5-digit zip code is required" }, { status: 400 });
  }

  try {
    const center = await geocodeZip(zip);
    if (!center) return NextResponse.json({ error: "Could not locate that zip code" }, { status: 404 });

    const data = await nhtsaFetch(
      `/CSSIStation?lat=${center.lat}&long=${center.lon}&miles=25`
    );

    const stations = resultsOf(data)
      .map((s) => {
        const lat = Number(s.LocationLatitude);
        const lon = Number(s.LocationLongitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const phone = typeof s.Phone1 === "string" ? s.Phone1.replace(/[^\d()+\-.\sx]/g, "").trim() : "";
        return {
          name: String(s.Organization || "Car seat inspection station"),
          address: [s.AddressLine1, s.City, s.State, s.Zip].filter(Boolean).join(", "),
          phone,
          mobile: s.MobileStationFlag === "Yes",
          distanceMiles: haversineMiles(center.lat, center.lon, lat, lon),
          lat,
          lon,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 10);

    return NextResponse.json({ stations, center });
  } catch (err) {
    console.error("GET /api/nhtsa/car-seats failed:", err);
    return NextResponse.json({ error: "Could not reach the NHTSA car seat locator" }, { status: 502 });
  }
}
