"use client";

import { useState } from "react";
import VehicleForm, { VehicleFormValues } from "@/components/VehicleForm";
import ServiceChecklist from "@/components/ServiceChecklist";
import ServiceCenters from "@/components/ServiceCenters";
import AskQuestion from "@/components/AskQuestion";
import type { ScheduleResult } from "@/lib/maintenanceSchedule";

type ScheduleResponse = {
  nextDue: { summary: string };
  schedule: ScheduleResult[];
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleResponse | null>(null);
  const [zip, setZip] = useState<string | null>(null);

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
      setZip(values.zip);
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
        find nearby shops, and ask automotive questions.
      </p>

      <div className="card">
        <h2>Your vehicle</h2>
        <VehicleForm onSubmit={handleSubmit} loading={loading} />
        {error && <div className="error-text">{error}</div>}
      </div>

      {result && (
        <ServiceChecklist
          nextDueSummary={result.nextDue.summary}
          schedule={result.schedule}
        />
      )}

      {zip && <ServiceCenters zip={zip} />}

      <AskQuestion />
    </main>
  );
}
