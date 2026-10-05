"use client";

import { useEffect, useState } from "react";
import VehicleForm, { VehicleFormValues } from "@/components/VehicleForm";
import ServiceChecklist from "@/components/ServiceChecklist";
import ServiceCenters from "@/components/ServiceCenters";
import VehicleSafety from "@/components/VehicleSafety";
import AskQuestion from "@/components/AskQuestion";
import type { ScheduleResult } from "@/lib/maintenanceSchedule";
import {
  DEFAULT_PREFS,
  Prefs,
  SavedVehicle,
  clearVehicle,
  getClientId,
  isSavedVehicle,
  loadPrefs,
  loadVehicle,
  savePrefs,
  saveVehicle,
} from "@/lib/storage";
import { vehicleLabel } from "@/lib/vehicle";

type ScheduleResponse = {
  nextDue: { summary: string };
  schedule: ScheduleResult[];
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResponse | null>(null);
  const [vehicle, setVehicle] = useState<VehicleFormValues | null>(null);

  const [saved, setSaved] = useState<SavedVehicle | null>(null);
  const [recent, setRecent] = useState<SavedVehicle[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  // Restore this browser's saved vehicle + prefs, then fetch recent
  // vehicles from the database for the same anonymous id.
  useEffect(() => {
    setSaved(loadVehicle());
    setPrefs(loadPrefs());
    fetch(`/api/searches?clientId=${getClientId()}`)
      .then((r) => (r.ok ? r.json() : { vehicles: [] }))
      .then((d) => setRecent((d.vehicles || []).filter(isSavedVehicle)))
      .catch(() => {});
  }, []);

  function updatePrefs(p: Prefs) {
    setPrefs(p);
    savePrefs(p);
  }

  async function handleSubmit(values: VehicleFormValues) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mileage: values.mileage,
          lastServiceDate: values.lastServiceDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setResult(data);
      setVehicle(values);

      // Remember it locally (instant prefill next visit) and in the database.
      saveVehicle(values);
      setSaved(values);
      fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), ...values }),
      }).catch(() => {});
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Car Service Reminder</h1>
      <p className="subtitle">
        Enter your vehicle and mileage details to see what maintenance is due,
        check safety ratings and recalls, find nearby help, and ask automotive
        questions.
      </p>

      <div className="card">
        <h2>Your vehicle</h2>
        <VehicleForm
          onSubmit={handleSubmit}
          loading={loading}
          saved={saved}
          recent={recent}
          onClearSaved={() => {
            clearVehicle();
            setSaved(null);
          }}
        />
        {error && <div className="error-text">{error}</div>}
      </div>

      {result && vehicle && (
        <ServiceChecklist
          nextDueSummary={result.nextDue.summary}
          schedule={result.schedule}
          mileage={vehicle.mileage}
          lastServiceDate={vehicle.lastServiceDate}
          vehicleLabel={vehicleLabel(vehicle)}
          prefs={prefs}
          onPrefsChange={updatePrefs}
        />
      )}

      {result && vehicle && (
        <VehicleSafety year={vehicle.year} make={vehicle.makeName} model={vehicle.modelName} />
      )}

      {result && vehicle && <ServiceCenters zip={vehicle.zip} />}

      <AskQuestion />
    </main>
  );
}
