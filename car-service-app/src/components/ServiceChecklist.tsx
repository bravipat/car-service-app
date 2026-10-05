"use client";

import { useState } from "react";
import type { ScheduleResult } from "@/lib/maintenanceSchedule";
import type { Prefs } from "@/lib/storage";
import { monthsUntil, formatEta, intervalComparison } from "@/lib/vehicle";

export default function ServiceChecklist({
  nextDueSummary,
  schedule,
  mileage,
  lastServiceDate,
  vehicleLabel,
  prefs,
  onPrefsChange,
}: {
  nextDueSummary: string;
  schedule: ScheduleResult[];
  mileage: number;
  lastServiceDate: string;
  vehicleLabel: string;
  prefs: Prefs;
  onPrefsChange: (p: Prefs) => void;
}) {
  const [shareNote, setShareNote] = useState<string | null>(null);
  const showMonths = prefs.unit === "months";

  function etaFor(entry: ScheduleResult): string {
    if (entry.status === "due") return "due now";
    return formatEta(monthsUntil(mileage, entry.triggerMiles, prefs.annualMiles));
  }

  function printSchedule() {
    const cls = "print-schedule";
    document.body.classList.add(cls);
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  function asText(): string {
    const lines = [
      `Service schedule — ${vehicleLabel}`,
      `Mileage: ${mileage.toLocaleString("en-US")} mi · Last service: ${lastServiceDate}`,
      nextDueSummary,
      "",
    ];
    for (const e of schedule) {
      lines.push(`${e.status === "due" ? "[DUE NOW]" : "[COMING UP]"} ${e.label} (${etaFor(e)})`);
      e.items.forEach((i) => lines.push(`  - ${i}`));
    }
    return lines.join("\n");
  }

  async function share() {
    const text = asText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Service schedule", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareNote("Copied to clipboard");
    } catch {
      setShareNote("Couldn't share — use Print instead");
    }
    setTimeout(() => setShareNote(null), 3000);
  }

  return (
    <div className="card print-target">
      {/* Shown only on paper */}
      <div className="print-only print-header">
        <h1>Service schedule</h1>
        <div>{vehicleLabel}</div>
        <div>
          Current mileage: {mileage.toLocaleString("en-US")} mi · Last service: {lastServiceDate}
        </div>
        <div>Printed {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
      </div>

      <div className="card-head">
        <h2>Your maintenance schedule</h2>
        <div className="toolbar no-print">
          <div className="seg" role="group" aria-label="Show estimates in">
            <button
              type="button"
              className={!showMonths ? "active" : ""}
              onClick={() => onPrefsChange({ ...prefs, unit: "miles" })}
            >
              Miles
            </button>
            <button
              type="button"
              className={showMonths ? "active" : ""}
              onClick={() => onPrefsChange({ ...prefs, unit: "months" })}
            >
              Months
            </button>
          </div>
          <button type="button" className="secondary" onClick={share}>
            Share
          </button>
          <button type="button" className="secondary" onClick={printSchedule}>
            Print
          </button>
        </div>
      </div>
      {shareNote && <p className="muted-note no-print">{shareNote}</p>}

      <div className="next-due-banner">
        {nextDueSummary}
        {showMonths && <div className="banner-sub">{intervalComparison(prefs.annualMiles)}</div>}
      </div>

      {showMonths && (
        <div className="annual-row no-print">
          <label htmlFor="annual">Miles driven per year</label>
          <input
            id="annual"
            type="number"
            min={1000}
            max={100000}
            step={500}
            value={prefs.annualMiles}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) onPrefsChange({ ...prefs, annualMiles: n });
            }}
          />
          <span className="muted-note">Estimates assume you keep driving about this much.</span>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {schedule.length === 0 && (
          <p className="muted-note">Nothing due or coming up within the next 5,000 miles.</p>
        )}
        {schedule.map((entry, i) => (
          <div key={i} className={`schedule-item ${entry.status === "due" ? "due" : "upcoming"}`}>
            <span className="badge">{entry.status === "due" ? "Due now" : "Coming up"}</span>
            <div>
              <strong>{entry.label}</strong>{" "}
              <span className="muted-note">
                {showMonths
                  ? `${etaFor(entry)} (at ${entry.triggerMiles.toLocaleString("en-US")} mi)`
                  : `(at ${entry.triggerMiles.toLocaleString("en-US")} mi)`}
              </span>
            </div>
            <ul>
              {entry.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="print-only muted-note">
        General maintenance guidance — check the owner&apos;s manual for your vehicle&apos;s specific schedule.
        Month estimates assume about {prefs.annualMiles.toLocaleString("en-US")} miles per year.
      </p>
    </div>
  );
}
