// Small helpers shared by the /api/nhtsa/* route handlers.
// All NHTSA endpoints used here are public and need no API key.

import { NextRequest } from "next/server";

const BASE = "https://api.nhtsa.gov";

export async function nhtsaFetch(path: string, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!res.ok) throw new Error(`NHTSA returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** The result array key is "Results" on some endpoints and "results" on others. */
export function resultsOf(data: any): any[] {
  const r = data?.results ?? data?.Results;
  return Array.isArray(r) ? r : [];
}

export type VehicleQuery = { year: number; make: string; model: string };

export function parseVehicle(req: NextRequest): VehicleQuery | null {
  const p = req.nextUrl.searchParams;
  const year = Number(p.get("year"));
  const make = (p.get("make") || "").trim();
  const model = (p.get("model") || "").trim();
  if (!Number.isInteger(year) || year < 1950 || year > 2100) return null;
  if (!make || !model || make.length > 60 || model.length > 80) return null;
  return { year, make, model };
}

export const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Our database's model names don't always match NHTSA's (e.g. "Accord Sedan"
 * vs "ACCORD"). Ask NHTSA which model names exist for that make/year and pick
 * the closest one. Returns the original name if nothing matches.
 * issueType: "r" = recalls, "c" = complaints.
 */
export async function resolveModelName(
  v: VehicleQuery,
  issueType: "r" | "c"
): Promise<string> {
  try {
    const data = await nhtsaFetch(
      `/products/vehicle/models?modelYear=${v.year}&make=${encodeURIComponent(
        v.make
      )}&issueType=${issueType}`
    );
    const names: string[] = resultsOf(data)
      .map((r) => String(r.model ?? r.Model ?? ""))
      .filter(Boolean);
    const target = norm(v.model);
    if (!target) return v.model;

    const exact = names.find((n) => norm(n) === target);
    if (exact) return exact;

    const partial = names
      .filter((n) => norm(n).includes(target) || target.includes(norm(n)))
      .sort(
        (a, b) =>
          Math.abs(norm(a).length - target.length) -
          Math.abs(norm(b).length - target.length)
      );
    return partial[0] ?? v.model;
  } catch {
    return v.model;
  }
}

export function clip(s: unknown, max: number): string {
  const t = typeof s === "string" ? s : "";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
