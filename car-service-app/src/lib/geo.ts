// Shared geocoding helpers (OpenStreetMap Nominatim) and distance math.
// Set a real contact email in USER_AGENT — Nominatim's usage policy asks for
// an identifying User-Agent.

export const USER_AGENT =
  "car-service-reminder-app/1.0 (contact: bharadwaj.ravipati@outlook.com)";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type LatLon = { lat: number; lon: number };

export async function geocodeZip(zip: string): Promise<LatLon | null> {
  const url = `${NOMINATIM_URL}?postalcode=${encodeURIComponent(
    zip
  )}&country=us&format=json&limit=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 60 * 60 * 24 * 30 }, // zip centroids don't move
  });
  if (!res.ok) return null;

  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const lat = parseFloat(results[0].lat);
  const lon = parseFloat(results[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function haversineMiles(
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
