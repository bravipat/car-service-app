"use client";

import { useEffect, useRef, useState } from "react";
import type { SavedVehicle } from "@/lib/storage";
import { vehicleLabel } from "@/lib/vehicle";

type Option = { id: number; name: string };

export type VehicleFormValues = SavedVehicle;

export default function VehicleForm({
  onSubmit,
  loading,
  saved,
  recent,
  onClearSaved,
}: {
  onSubmit: (values: VehicleFormValues) => void;
  loading: boolean;
  saved: SavedVehicle | null;
  recent: SavedVehicle[];
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

    const mileageNum = Number(mileage);
    if (!mileage || !Number.isFinite(mileageNum) || mileageNum < 0) {
      setError("Enter a valid current mileage.");
      return;
    }
    if (!lastServiceDate) {
      setError("Enter the date of your last service.");
      return;
    }
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a valid 5-digit zip code.");
      return;
    }
    if (!makeId || !modelId || !year) {
      setError("Select your vehicle's make, model, and year.");
      return;
    }

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
    <form onSubmit={handleSubmit}>
      {recent.length > 0 && (
        <div className="recent-row">
          <span className="recent-label">Recent</span>
          {recent.map((v, i) => (
            <button
              type="button"
              key={i}
              className="chip"
              onClick={() => applySaved(v)}
              title={`${v.mileage.toLocaleString("en-US")} mi · zip ${v.zip}`}
            >
              {vehicleLabel(v)}
            </button>
          ))}
        </div>
      )}
      <fieldset className="field-group">
        <legend>Vehicle</legend>
        <div className="form-grid three">
        <div>
          <label htmlFor="make">Make</label>
          <select
            id="make"
            value={makeId}
            onChange={(e) => handleMakeChange(e.target.value)}
          >
            <option value="">Select make…</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="model">Model</label>
          <select
            id="model"
            value={modelId}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!makeId}
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="year">Year</label>
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={!modelId}
          >
            <option value="">Select year…</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>Service details</legend>
        <div className="form-grid three">
        <div>
          <label htmlFor="mileage">Current mileage</label>
          <input
            id="mileage"
            type="number"
            min={0}
            placeholder="e.g. 42000"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="lastServiceDate">Last service date</label>
          <input
            id="lastServiceDate"
            type="date"
            max={today || undefined}
            value={lastServiceDate}
            onChange={(e) => setLastServiceDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="zip">Zip code</label>
          <input
            id="zip"
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 08540"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        </div>
      </fieldset>

      {error && <div className="error-text">{error}</div>}

      <div className="submit-row">
        <button type="submit" disabled={loading}>
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
            }}
          >
            Forget saved vehicle
          </button>
        )}
      </div>
    </form>
  );
}
