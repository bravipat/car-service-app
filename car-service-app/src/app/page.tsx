"use client";

import { useEffect, useRef, useState } from "react";
import VehicleForm, { VehicleFormValues } from "@/components/VehicleForm";
import VehicleDash, { Odometer } from "@/components/VehicleDash";
import ServiceChecklist from "@/components/ServiceChecklist";
import ServiceCenters from "@/components/ServiceCenters";
import VehicleSafety from "@/components/VehicleSafety";
import AskQuestion from "@/components/AskQuestion";
import Reveal from "@/components/Reveal";
import CarArt from "@/components/CarArt";
import ToastHost, { type Toast, type ToastKind } from "@/components/Toast";
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

type TabId = "schedule" | "safety" | "nearby";

const TABS: { id: TabId; label: string }[] = [
  { id: "schedule", label: "Maintenance" },
  { id: "safety", label: "Safety & recalls" },
  { id: "nearby", label: "Nearby help" },
];

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResponse | null>(null);
  const [vehicle, setVehicle] = useState<VehicleFormValues | null>(null);
  const [editing, setEditing] = useState(false);

  const [tab, setTab] = useState<TabId>("schedule");
  // Tabs that do network work (NHTSA, map) only mount once they've been opened.
  const [visited, setVisited] = useState<Partial<Record<TabId, boolean>>>({ schedule: true });

  const [saved, setSaved] = useState<SavedVehicle | null>(null);
  const [recent, setRecent] = useState<SavedVehicle[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const formRef = useRef<HTMLDivElement | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  function notify(kind: ToastKind, message: string) {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4500);
  }
  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  function startHere() {
    document.getElementById("vehicle-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => document.getElementById("make")?.focus({ preventScroll: true }), 350);
  }

  // Restore this browser's saved vehicle + prefs, then fetch recent
  // vehicles from the database for the same anonymous id.
  function refreshRecent() {
    return fetch(`/api/searches?clientId=${getClientId()}`)
      .then((r) => (r.ok ? r.json() : { vehicles: [] }))
      .then((d) => setRecent((d.vehicles || []).filter(isSavedVehicle)))
      .catch(() => {});
  }

  useEffect(() => {
    setSaved(loadVehicle());
    setPrefs(loadPrefs());
    refreshRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delete one recent vehicle, or all of them when no vehicle is given.
  async function deleteRecent(v?: SavedVehicle) {
    const params = new URLSearchParams({ clientId: getClientId() });
    if (v) {
      params.set("makeId", String(v.makeId));
      params.set("modelId", String(v.modelId));
      params.set("year", String(v.year));
    }
    try {
      const res = await fetch(`/api/searches?${params}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      // Also forget the on-device copy if it is one of the vehicles just removed.
      const s = loadVehicle();
      if (s && (!v || (s.makeId === v.makeId && s.modelId === v.modelId && s.year === v.year))) {
        clearVehicle();
        setSaved(null);
      }
      await refreshRecent();
      notify("success", v ? `Removed ${vehicleLabel(v)} from your recent searches.` : "Cleared your recent searches.");
    } catch {
      notify("error", "Couldn't delete that. Please try again.");
    }
  }

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
      notify("success", `Schedule ready for your ${vehicleLabel(values)}.`);
      setEditing(false);
      setTab("schedule");
      setVisited({ schedule: true }); // safety + nearby start fresh for the new vehicle
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Remember it locally (instant prefill next visit) and in the database.
      saveVehicle(values);
      setSaved(values);
      fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), ...values }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("save failed");
        })
        .catch(() => notify("error", "Couldn't save this search to your history. It's still saved on this device."));
    } catch (err: any) {
      const msg = err?.message || "Something went wrong";
      setError(msg);
      notify("error", `Couldn't check your schedule: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const hasVehicle = !!(result && vehicle);
  const showForm = !hasVehicle || editing;
  const vehicleKey = vehicle ? `${vehicle.year}|${vehicle.makeName}|${vehicle.modelName}|${vehicle.zip}` : "";

  const dueCount = result ? result.schedule.filter((e) => e.status === "due").length : 0;
  const upcomingCount = result ? result.schedule.length - dueCount : 0;

  return (
    <main className="container" id="top">
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="Car Service Reminder, back to top">
          <span className="mark" aria-hidden="true">
            <i />
          </span>
          <span className="brand">Car Service Reminder</span>
        </a>
        <nav className="site-nav" aria-label="Page">
          <a href={hasVehicle && !editing ? "#vehicle-summary" : "#vehicle-form"}>Your car</a>
          <a href="#ask">Ask a question</a>
          {hasVehicle && <a href="#results">Results</a>}
        </nav>
      </header>

      {!hasVehicle && (
        <Reveal>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-grid">
              <div>
                <p className="eyebrow">Maintenance · Safety · Nearby help</p>
                <h1 id="hero-title">Know what your car needs next</h1>
                <p className="hero-sub">
                  Enter your car and mileage to see what maintenance is due, check safety ratings and recalls, and
                  find trusted help nearby.
                </p>
                <button type="button" className="btn cta" onClick={startHere}>
                  Check my schedule
                </button>
              </div>
              <div className="hero-odo">
                <CarArt />
                <Odometer value={0} caption="Your mileage goes here" />
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {showForm && (
        <section id="vehicle-form" className={`card form-card ${hasVehicle ? "" : "overlap"}`} ref={formRef}>
          <h2>{hasVehicle ? "Change vehicle" : "Your vehicle"}</h2>
          <VehicleForm
            onSubmit={handleSubmit}
            loading={loading}
            saved={saved}
            recent={recent}
            onDeleteRecent={deleteRecent}
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
          {error && (
            <div className="error-text" role="alert">
              {error}
            </div>
          )}
        </section>
      )}

      {hasVehicle && !editing && vehicle && (
        <Reveal id="vehicle-summary">
        <VehicleDash
          label={vehicleLabel(vehicle)}
          mileage={vehicle.mileage}
          zip={vehicle.zip}
          lastServiceDate={vehicle.lastServiceDate}
          dueCount={dueCount}
          upcomingCount={upcomingCount}
          onEdit={() => {
            setEditing(true);
            setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
          }}
        />
        </Reveal>
      )}

      <Reveal id="ask">
        <AskQuestion />
      </Reveal>

      {hasVehicle && vehicle && result && (
        <Reveal id="results">
        <div className="sheet">
          <nav className="tab-nav" role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                className={`nav-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => openTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

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
        </div>
        </Reveal>
      )}

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
