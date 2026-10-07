"use client";

// The dark "dashboard" panel shown once a vehicle is entered: name, odometer-style
// mileage readout, and a quick count of what is due / coming up.

export function Odometer({ value, caption }: { value: number; caption?: string }) {
  const digits = String(Math.max(0, Math.round(value))).padStart(6, "0").slice(-6).split("");
  return (
    <div>
      <div className="odo" role="img" aria-label={`${Math.round(value).toLocaleString("en-US")} miles`}>
        {digits.map((d, i) => (
          <b key={i}>{d}</b>
        ))}
        <span>mi</span>
      </div>
      {caption && <div className="odo-cap">{caption}</div>}
    </div>
  );
}

function monthsSince(isoDate: string): number {
  const then = new Date(isoDate + "T00:00:00").getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, (Date.now() - then) / (1000 * 60 * 60 * 24 * 30.44));
}

export default function VehicleDash({
  label,
  mileage,
  zip,
  lastServiceDate,
  dueCount,
  upcomingCount,
  onEdit,
}: {
  label: string;
  mileage: number;
  zip: string;
  lastServiceDate: string;
  dueCount: number;
  upcomingCount: number;
  onEdit: () => void;
}) {
  const months = monthsSince(lastServiceDate);
  const pct = Math.min(100, Math.round((months / 6) * 100));
  return (
    <section className="dash" aria-label="Your vehicle">
      <div className="dash-grid">
        <div>
          <h1 className="vname">{label}</h1>
          <div className="vmeta">
            Zip {zip} · Last service {lastServiceDate}
          </div>
          <button type="button" className="ghost" onClick={onEdit}>
            Change vehicle
          </button>
        </div>

        <Odometer value={mileage} caption="Current mileage" />

        <div className="stats">
          <div className="stat">
            <span className={`n ${dueCount ? "red" : ""}`}>{dueCount}</span>
            <span className="l">due now</span>
          </div>
          <div className="stat">
            <span className={`n ${upcomingCount ? "amb" : ""}`}>{upcomingCount}</span>
            <span className="l">coming up</span>
          </div>
          <div className="since">
            <div className="stat">
              <span className="n small">
                {months.toFixed(1)}
                <small> / 6 mo</small>
              </span>
              <span className="l">since last service</span>
            </div>
            <div className="bar" role="presentation">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
