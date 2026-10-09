"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedVehicle } from "@/lib/storage";
import { vehicleLabel } from "@/lib/vehicle";

type Option = { id: number; name: string };

export type VehicleFormValues = SavedVehicle;

type Field = "make" | "model" | "year" | "mileage" | "date" | "zip";
const FIELD_ORDER: Field[] = ["make", "model", "year", "mileage", "date", "zip"];
const FIELD_ID: Record<Field, string> = {
  make: "make",
  model: "model",
  year: "year",
  mileage: "mileage",
  date: "lastServiceDate",
  zip: "zip",
};

export default function VehicleForm({
  onSubmit,
  loading,
  saved,
  recent,
  onDeleteRecent,
  onClearSaved,
}: {
  onSubmit: (values: VehicleFormValues) => void;
  loading: boolean;
  saved: SavedVehicle | null;
  recent: SavedVehicle[];
  onDeleteRecent: (v?: SavedVehicle) => void;
  onClearSaved: () => void;
}) {
  const [makes, setMakes] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [mileage, setMileage] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [zip, setZip] = useState("");
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [year, setYear] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  useEffect(() => {
    fetch("/api/makes")
      .then((r) => r.json())
      .then(setMakes)
      .catch(() => setError("Could not load vehicle makes"));
  }, []);

  const restored = useRef(false);

  // Latest allowed "last service" date: today in the visitor's own timezone
  // (not UTC, which can already be "tomorrow" in the evening in the US).
  const [today, setToday] = useState("");
  useEffect(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setToday(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }, []);

  async function loadModels(id: string): Promise<Option[]> {
    const r = await fetch(`/api/models?makeId=${id}`);
    return r.ok ? r.json() : [];
  }
  async function loadYears(id: string): Promise<number[]> {
    const r = await fetch(`/api/years?modelId=${id}`);
    return r.ok ? r.json() : [];
  }

  function valueOf(f: Field): string {
    return { make: makeId, model: modelId, year, mileage, date: lastServiceDate, zip }[f];
  }

  function check(f: Field, v: string): string {
    switch (f) {
      case "make":
        return v ? "" : "Select your vehicle's make.";
      case "model":
        return v ? "" : "Select your vehicle's model.";
      case "year":
        return v ? "" : "Select the model year.";
      case "mileage": {
        if (v.trim() === "") return "Enter your current mileage.";
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return "Mileage can't be negative.";
        if (!Number.isInteger(n)) return "Use a whole number, like 42000.";
        if (n > 1_000_000) return "That mileage looks too high — please check it.";
        return "";
      }
      case "date":
        if (!v) return "Enter the date of your last service.";
        if (today && v > today) return "Last service date can't be in the future.";
        if (v < "1980-01-01") return "Enter a date after 1980.";
        return "";
      case "zip":
        return /^\d{5}$/.test(v) ? "" : "Enter a 5-digit zip code.";
    }
  }

  // Validate when the visitor leaves a field, and re-check live once it has an error.
  function validateField(f: Field, v: string = valueOf(f)) {
    setErrors((e) => ({ ...e, [f]: check(f, v) }));
  }
  function liveCheck(f: Field, v: string) {
    if (errors[f]) validateField(f, v);
  }
  function fieldProps(f: Field) {
    const id = FIELD_ID[f];
    return {
      id,
      "aria-invalid": errors[f] ? true : undefined,
      "aria-describedby": errors[f] ? `${id}-err` : undefined,
      className: errors[f] ? "invalid" : undefined,
      onBlur: () => validateField(f),
    };
  }
  function fieldError(f: Field) {
    return errors[f] ? (
      <p className="field-error" id={`${FIELD_ID[f]}-err`} role="alert">
        {errors[f]}
      </p>
    ) : null;
  }

  // Cascading dropdowns are driven by the user's changes (not effects), so
  // restoring a saved vehicle can set all three values without being reset.
  async function handleMakeChange(id: string) {
    setMakeId(id);
    setModelId("");
    setYear("");
    setModels([]);
    setYears([]);
    if (!id) return;
    try {
      setModels(await loadModels(id));
    } catch {
      setError("Could not load models");
    }
  }

  async function handleModelChange(id: string) {
    setModelId(id);
    setYear("");
    setYears([]);
    if (!id) return;
    try {
      setYears(await loadYears(id));
    } catch {
      setError("Could not load years");
    }
  }

  async function applySaved(v: SavedVehicle) {
    setError(null);
    setErrors({});
    setMileage(String(v.mileage));
    setLastServiceDate(v.lastServiceDate);
    setZip(v.zip);
    try {
      const [m, y] = await Promise.all([loadModels(String(v.makeId)), loadYears(String(v.modelId))]);
      setModels(m);
      setYears(y);
    } catch {
      setError("Could not restore your saved vehicle's make/model.");
    }
    setMakeId(String(v.makeId));
    setModelId(String(v.modelId));
    setYear(String(v.year));
  }

  // Restore the browser's saved vehicle once, as soon as it's available.
  useEffect(() => {
    if (saved && !restored.current) {
      restored.current = true;
      applySaved(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const found: Partial<Record<Field, string>> = {};
    for (const f of FIELD_ORDER) {
      const msg = check(f, valueOf(f));
      if (msg) found[f] = msg;
    }
    setErrors(found);
    const firstBad = FIELD_ORDER.find((f) => {
      if (!found[f]) return false;
      const el = document.getElementById(FIELD_ID[f]) as HTMLInputElement | HTMLSelectElement | null;
      return !!el && !el.disabled;
    });
    if (firstBad) {
      document.getElementById(FIELD_ID[firstBad])?.focus();
      return;
    }
    if (Object.keys(found).length) return;

    const mileageNum = Number(mileage);

    const makeName = makes.find((m) => String(m.id) === makeId)?.name;
    const modelName = models.find((m) => String(m.id) === modelId)?.name;
    if (!makeName || !modelName) {
      setError("Select your vehicle's make and model.");
      return;
    }

    onSubmit({
      mileage: mileageNum,
      lastServiceDate,
      zip,
      makeId: Number(makeId),
      modelId: Number(modelId),
      year: Number(year),
      makeName,
      modelName,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {recent.length > 0 && (
        <div className="recent-row">
          <span className="recent-label">Recent</span>
          {recent.map((v) => (
            <span className="chip-wrap" key={`${v.makeId}-${v.modelId}-${v.year}`}>
              <button
                type="button"
                className="chip"
                onClick={() => applySaved(v)}
                title={`${v.mileage.toLocaleString("en-US")} mi · zip ${v.zip}`}
              >
                {vehicleLabel(v)}
              </button>
              <button
                type="button"
                className="chip-x"
                aria-label={`Remove ${vehicleLabel(v)} from recent searches`}
                title="Remove"
                onClick={() => onDeleteRecent(v)}
              >
                ×
              </button>
            </span>
          ))}
          {confirmClear ? (
            <span className="confirm-clear" role="group" aria-label="Confirm clearing recent searches">
              Clear all?
              <button
                type="button"
                className="link-btn danger"
                onClick={() => {
                  setConfirmClear(false);
                  onDeleteRecent();
                }}
              >
                Yes, clear
              </button>
              <button type="button" className="link-btn" onClick={() => setConfirmClear(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="link-btn" onClick={() => setConfirmClear(true)}>
              Clear all
            </button>
          )}
        </div>
      )}
      <fieldset className="field-group">
        <legend>Vehicle</legend>
        <div className="form-grid three">
        <div>
          <label htmlFor="make">Make</label>
          <select
            {...fieldProps("make")}
            value={makeId}
            onChange={(e) => {
              handleMakeChange(e.target.value);
              liveCheck("make", e.target.value);
            }}
          >
            <option value="">Select make…</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {fieldError("make")}
        </div>
        <div>
          <label htmlFor="model">Model</label>
          <select
            {...fieldProps("model")}
            value={modelId}
            onChange={(e) => {
              handleModelChange(e.target.value);
              liveCheck("model", e.target.value);
            }}
            disabled={!makeId}
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {fieldError("model")}
        </div>
        <div>
          <label htmlFor="year">Year</label>
          <select
            {...fieldProps("year")}
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              liveCheck("year", e.target.value);
            }}
            disabled={!modelId}
          >
            <option value="">Select year…</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {fieldError("year")}
        </div>
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>Service details</legend>
        <div className="form-grid three">
        <div>
          <label htmlFor="mileage">Current mileage</label>
          <input
            {...fieldProps("mileage")}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="e.g. 42000"
            value={mileage}
            onChange={(e) => {
              setMileage(e.target.value);
              liveCheck("mileage", e.target.value);
            }}
          />
          {fieldError("mileage")}
        </div>
        <div>
          <label htmlFor="lastServiceDate">Last service date</label>
          <input
            {...fieldProps("date")}
            type="date"
            max={today || undefined}
            value={lastServiceDate}
            onChange={(e) => {
              setLastServiceDate(e.target.value);
              liveCheck("date", e.target.value);
            }}
          />
          {fieldError("date")}
        </div>
        <div>
          <label htmlFor="zip">Zip code</label>
          <input
            {...fieldProps("zip")}
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 08540"
            value={zip}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setZip(v);
              liveCheck("zip", v);
            }}
          />
          {fieldError("zip")}
        </div>
        </div>
      </fieldset>

      {error && <div className="error-text">{error}</div>}

      <div className="submit-row">
        <button type="submit" className="btn primary" disabled={loading} aria-busy={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? "Checking…" : "Check my maintenance schedule"}
        </button>
        {saved && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              onClearSaved();
              setMileage("");
              setLastServiceDate("");
              setZip("");
              setMakeId("");
              setModelId("");
              setYear("");
              setModels([]);
              setYears([]);
              setErrors({});
            }}
          >
            Forget saved vehicle
          </button>
        )}
      </div>
    </form>
  );
}
