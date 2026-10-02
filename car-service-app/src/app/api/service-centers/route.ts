import { NextRequest, NextResponse } from "next/server";

// Free, no-API-key lookup: geocode the zip with OpenStreetMap's Nominatim,
// then search Overpass for nearby car-repair shops. Both are public
// OpenStreetMap services with usage policies that require a descriptive
// User-Agent and reasonable request rates — fine for this app's traffic.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "car-service-reminder-app/1.0 (contact: set-your-email-here)";
const SEARCH_RADIUS_METERS = 16093; // ~10 miles

type Center = {
  name: string;
  address: string;
  distanceMiles: number;
  lat: number;
  lon: number;
};

async function geocodeZip(zip: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM_URL}?postalcode=${encodeURIComponent(
    zip
  )}&country=us&format=json&limit=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function findNearbyShops(
  lat: number,
  lon: number
): Promise<Center[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["shop"="car_repair"](around:${SEARCH_RADIUS_METERS},${lat},${lon});
      way["shop"="car_repair"](around:${SEARCH_RADIUS_METERS},${lat},${lon});
    );
    out center 20;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": USER_AGENT,
    },
    body: query,
  });
  if (!res.ok) {
    throw new Error(`Overpass API returned ${res.status}`);
  }

  const data = await res.json();
  const elements: any[] = data.elements || [];

  const centers: Center[] = elements
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (elLat == null || elLon == null) return null;

      const tags = el.tags || {};
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
        tags["addr:state"],
        tags["addr:postcode"],
      ].filter(Boolean);

      return {
        name: tags.name || "Auto repair shop (unnamed)",
        address: addressParts.length
          ? addressParts.join(" ")
          : "Address unavailable",
        distanceMiles: haversineMiles(lat, lon, elLat, elLon),
        lat: elLat,
        lon: elLon,
      };
    })
    .filter((c): c is Center => c !== null)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, 10);

  return centers;
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: "A valid 5-digit US zip code is required" },
      { status: 400 }
    );
  }

  try {
    const coords = await geocodeZip(zip);
    if (!coords) {
      return NextResponse.json(
        { error: "Could not locate that zip code" },
        { status: 404 }
      );
    }

    const centers = await findNearbyShops(coords.lat, coords.lon);
    return NextResponse.json({ centers });
  } catch (err) {
    console.error("GET /api/service-centers failed:", err);
    return NextResponse.json(
      { error: "Failed to look up service centers" },
      { status: 500 }
    );
  }
}
