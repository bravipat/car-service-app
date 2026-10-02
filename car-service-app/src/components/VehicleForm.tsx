"use client";

import { useEffect, useState } from "react";

type Option = { id: number; name: string };

export type VehicleFormValues = {
  mileage: number;
  lastServiceDate: string;
  zip: string;
  makeId: number;
  modelId: number;
  year: number;
};

export default function VehicleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (values: VehicleFormValues) => void;
  loading: boolean;
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

  useEffect(() => {
    setModelId("");
    setModels([]);
    setYears([]);
    setYear("");
    if (!makeId) return;
    fetch(`/api/models?makeId=${makeId}`)
      .then((r) => r.json())
      .then(setModels)
      .catch(() => setError("Could not load models"));
  }, [makeId]);

  useEffect(() => {
    setYear("");
    setYears([]);
    if (!modelId) return;
    fetch(`/api/years?modelId=${modelId}`)
      .then((r) => r.json())
      .then(setYears)
      .catch(() => setError("Could not load years"));
  }, [modelId]);

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

    onSubmit({
      mileage: mileageNum,
      lastServiceDate,
      zip,
      makeId: Number(makeId),
      modelId: Number(modelId),
      year: Number(year),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
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
        <div />
        <div>
          <label htmlFor="make">Make</label>
          <select
            id="make"
            value={makeId}
            onChange={(e) => setMakeId(e.target.value)}
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
            onChange={(e) => setModelId(e.target.value)}
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

      {error && <div className="error-text">{error}</div>}

      <div className="submit-row">
        <button type="submit" disabled={loading}>
          {loading ? "Checking…" : "Check my maintenance schedule"}
        </button>
      </div>
    </form>
  );
}
