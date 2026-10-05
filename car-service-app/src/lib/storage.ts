// Browser-only persistence for the saved vehicle and display preferences.
// Every access is wrapped: localStorage can throw (private mode, blocked
// site data) and the app must keep working without it.

export type SavedVehicle = {
  mileage: number;
  lastServiceDate: string; // YYYY-MM-DD
  zip: string;
  makeId: number;
  modelId: number;
  year: number;
  makeName: string;
  modelName: string;
};

export type Prefs = { unit: "miles" | "months"; annualMiles: number };

const KEY_VEHICLE = "csr:vehicle:v1";
const KEY_CLIENT = "csr:client:v1";
const KEY_PREFS = "csr:prefs:v1";

export const DEFAULT_PREFS: Prefs = { unit: "miles", annualMiles: 12000 };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function isSavedVehicle(v: any): v is SavedVehicle {
  return (
    v &&
    Number.isFinite(v.mileage) && v.mileage >= 0 &&
    typeof v.lastServiceDate === "string" &&
    /^\d{5}$/.test(v.zip) &&
    Number.isInteger(v.makeId) && Number.isInteger(v.modelId) && Number.isInteger(v.year) &&
    typeof v.makeName === "string" && typeof v.modelName === "string"
  );
}

export function loadVehicle(): SavedVehicle | null {
  const raw = read(KEY_VEHICLE);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return isSavedVehicle(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveVehicle(v: SavedVehicle) {
  write(KEY_VEHICLE, JSON.stringify(v));
}

export function clearVehicle() {
  write(KEY_VEHICLE, null);
}

/** Anonymous random id that ties this browser to its saved-vehicle rows. */
export function getClientId(): string {
  const existing = read(KEY_CLIENT);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
  write(KEY_CLIENT, id);
  return id;
}

export function loadPrefs(): Prefs {
  const raw = read(KEY_PREFS);
  if (!raw) return DEFAULT_PREFS;
  try {
    const p = JSON.parse(raw);
    const annual = Number(p.annualMiles);
    return {
      unit: p.unit === "months" ? "months" : "miles",
      annualMiles: Number.isFinite(annual) && annual >= 1000 && annual <= 100000 ? annual : DEFAULT_PREFS.annualMiles,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  write(KEY_PREFS, JSON.stringify(p));
}
