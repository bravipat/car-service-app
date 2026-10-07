"use client";

import { useEffect, useRef, useState } from "react";
import VehicleForm, { VehicleFormValues } from "@/components/VehicleForm";
import VehicleBar from "@/components/VehicleBar";
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

type TabId = "schedule" | "safety" | "nearby" | "ask";

const TABS: { id: TabId; label: string; needsVehicle: boolean }[] = [
  { id: "schedule", label: "Maintenance", needsVehicle: true },
  { id: "safety", label: "Safety & recalls", needsVehicle: true },
  { id: "nearby", label: "Nearby help", needsVehicle: true },
  { id: "ask", label: "Ask a question", needsVehicle: false },
];

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResponse | null>(null);
  const [vehicle, setVehicle] = useState<VehicleFormValues | null>(null);
  const [editing, setEditing] = useState(false);

  const [tab, setTab] = useState<TabId>("ask");
  // Tabs that do network work (NHTSA, map) only mount once they've been opened.
  const [visited, setVisited] = useState<Partial<Record<TabId, boolean>>>({ ask: true });

  const [saved, setSaved] = useState<SavedVehicle | null>(null);
  const [recent, setRecent] = useState<SavedVehicle[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const formRef = useRef<HTMLDivElement | null>(null);

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

  function openTab(id: TabId) {
    setTab(id);
    setVisited((v) => ({ ...v, [id]: true }));
  }

  async function handleSubmit(values: VehicleFormValues) {
    setLoading(true);
    setError(null);

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
      setEditing(false);
      setTab("schedule");
      setVisited({ schedule: true, ask: true }); // safety + nearby start fresh for the new vehicle
      window.scrollTo({ top: 0, behavior: "smooth" });

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

  const hasVehicle = !!(result && vehicle);
  const showForm = !hasVehicle || editing;
  const vehicleKey = vehicle ? `${vehicle.year}|${vehicle.makeName}|${vehicle.modelName}|${vehicle.zip}` : "";

  return (
    <main className="container">
      <header className="site-header">
        <h1>Car Service Reminder</h1>
        <p className="subtitle">
          See what maintenance is due, check safety ratings and recalls for your car, and find help nearby.
        </p>
      </header>

      {showForm && (
        <section className="card form-card" ref={formRef}>
          <h2>{hasVehicle ? "Change vehicle" : "Your vehicle"}</h2>
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
          {hasVehicle && (
            <button type="button" className="link-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          {error && <div className="error-text">{error}</div>}
        </section>
      )}

      <div className="sticky-head">
        {hasVehicle && !editing && vehicle && (
          <VehicleBar
            label={vehicleLabel(vehicle)}
            mileage={vehicle.mileage}
            zip={vehicle.zip}
            lastServiceDate={vehicle.lastServiceDate}
            onEdit={() => {
              setEditing(true);
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}
          />
        )}
        <nav className="tab-nav" role="tablist" aria-label="Sections">
          {TABS.map((t) => {
            const disabled = t.needsVehicle && !hasVehicle;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                disabled={disabled}
                title={disabled ? "Enter your vehicle first" : undefined}
                className={`nav-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => openTab(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {!hasVehicle && tab === "ask" && (
        <p className="muted-note hint">
          Enter your vehicle above to unlock your maintenance schedule, safety and recall information, and nearby
          help. You can ask driving and car questions right away.
        </p>
      )}

      {hasVehicle && vehicle && result && (
        <>
          <section id="panel-schedule" role="tabpanel" aria-labelledby="tab-schedule" className="tab-panel" hidden={tab !== "schedule"}>
            {visited.schedule && (
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
          </section>

          <section id="panel-safety" role="tabpanel" aria-labelledby="tab-safety" className="tab-panel" hidden={tab !== "safety"}>
            {visited.safety && (
              <VehicleSafety key={vehicleKey} year={vehicle.year} make={vehicle.makeName} model={vehicle.modelName} />
            )}
          </section>

          <section id="panel-nearby" role="tabpanel" aria-labelledby="tab-nearby" className="tab-panel" hidden={tab !== "nearby"}>
            {visited.nearby && <ServiceCenters key={vehicleKey} zip={vehicle.zip} visible={tab === "nearby"} />}
          </section>
        </>
      )}

      <section id="panel-ask" role="tabpanel" aria-labelledby="tab-ask" className="tab-panel" hidden={tab !== "ask"}>
        <AskQuestion />
      </section>
    </main>
  );
}
