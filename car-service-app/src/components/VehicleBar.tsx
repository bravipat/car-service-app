"use client";

// Compact, sticky summary of the vehicle being viewed. The mileage is shown as an
// odometer-style readout — the one deliberately distinctive element of the UI.

export default function VehicleBar({
  label,
  mileage,
  zip,
  lastServiceDate,
  onEdit,
}: {
  label: string;
  mileage: number;
  zip: string;
  lastServiceDate: string;
  onEdit: () => void;
}) {
  const digits = String(Math.max(0, Math.round(mileage))).padStart(6, "0").split("");
  return (
    <div className="vehicle-bar">
      <div className="vehicle-id">
        <div className="vehicle-name">{label}</div>
        <div className="vehicle-meta">
          Zip {zip} · Last service {lastServiceDate}
        </div>
      </div>
      <div className="odometer" role="img" aria-label={`${mileage.toLocaleString("en-US")} miles`}>
        {digits.map((d, i) => (
          <span className="odo-digit" key={i}>
            {d}
          </span>
        ))}
        <span className="odo-unit">mi</span>
      </div>
      <button type="button" className="secondary" onClick={onEdit}>
        Change vehicle
      </button>
    </div>
  );
}
