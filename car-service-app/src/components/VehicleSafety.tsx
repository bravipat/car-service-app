"use client";

import { useEffect, useRef, useState } from "react";

type TabId = "ratings" | "recalls" | "complaints" | "bulletins";

const TABS: { id: TabId; label: string; path: string }[] = [
  { id: "ratings", label: "Safety ratings", path: "safety" },
  { id: "recalls", label: "Recalls", path: "recalls" },
  { id: "complaints", label: "Complaints", path: "complaints" },
  { id: "bulletins", label: "Manufacturer communications", path: "mfr-comms" },
];

type State = { status: "loading" | "ready" | "error"; data?: any; error?: string };

function Stars({ value }: { value: unknown }) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    return <span className="muted-note">{value ? String(value) : "Not rated"}</span>;
  }
  return (
    <span aria-label={`${n} out of 5 stars`} className="stars">
      {"★".repeat(n)}
      <span className="stars-off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function VehicleSafety({
  year,
  make,
  model,
}: {
  year: number;
  make: string;
  model: string;
}) {
  const [tab, setTab] = useState<TabId>("ratings");
  const [cache, setCache] = useState<Partial<Record<TabId, State>>>({});

  const vehicleKey = `${year}|${make}|${model}`;

  const requested = useRef<Set<string>>(new Set());
  const currentKey = useRef(vehicleKey);
  currentKey.current = vehicleKey;

  // New vehicle → forget everything fetched for the previous one.
  useEffect(() => {
    requested.current.clear();
    setCache({});
  }, [vehicleKey]);

  // Fetch the visible tab the first time it's opened for this vehicle.
  useEffect(() => {
    const id = `${vehicleKey}:${tab}`;
    if (requested.current.has(id)) return;
    requested.current.add(id);

    const meta = TABS.find((t) => t.id === tab)!;
    setCache((c) => ({ ...c, [tab]: { status: "loading" } }));

    const qs = new URLSearchParams({ year: String(year), make, model });
    const apply = (s: State) => {
      if (currentKey.current === vehicleKey) setCache((c) => ({ ...c, [tab]: s }));
    };
    fetch(`/api/nhtsa/${meta.path}?${qs}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Lookup failed");
        return body;
      })
      .then((data) => apply({ status: "ready", data }))
      .catch((e) => {
        requested.current.delete(id); // allow retry on next visit
        apply({ status: "error", error: e.message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, vehicleKey]);

  const state = cache[tab];

  return (
    <div className="card">
      <h2>
        Safety &amp; recall information — {year} {make} {model}
      </h2>
      <div className="tab-row" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(!state || state.status === "loading") && <p className="spinner-text">Loading from NHTSA…</p>}
      {state?.status === "error" && <p className="error-text">{state.error}</p>}

      {state?.status === "ready" && tab === "ratings" && <Ratings data={state.data} />}
      {state?.status === "ready" && tab === "recalls" && <Recalls data={state.data} />}
      {state?.status === "ready" && tab === "complaints" && <Complaints data={state.data} />}
      {state?.status === "ready" && tab === "bulletins" && <Bulletins data={state.data} />}

      <p className="muted-note">
        Source: U.S. National Highway Traffic Safety Administration (NHTSA). Always confirm recalls for your exact
        vehicle by VIN at nhtsa.gov/recalls.
      </p>
    </div>
  );
}

function Ratings({ data }: { data: any }) {
  const list: any[] = data.ratings || [];
  if (!list.length) {
    return <p className="muted-note">NHTSA has no 5-Star Safety Ratings for this model year.</p>;
  }
  return (
    <>
      {list.map((r) => (
        <div className="info-block" key={r.id}>
          <div className="info-title">{r.description}</div>
          <table className="rating-table">
            <tbody>
              <tr><th>Overall</th><td><Stars value={r.overall} /></td></tr>
              <tr><th>Frontal crash</th><td><Stars value={r.frontal} /></td></tr>
              <tr><th>Side crash</th><td><Stars value={r.side} /></td></tr>
              <tr>
                <th>Rollover</th>
                <td>
                  <Stars value={r.rollover} />
                  {r.rolloverChance ? (
                    <span className="muted-note"> ({Math.round(Number(r.rolloverChance) * 1000) / 10}% risk)</span>
                  ) : null}
                </td>
              </tr>
              <tr><th>Side pole</th><td><Stars value={r.sidePole} /></td></tr>
            </tbody>
          </table>
          <div className="muted-note">
            Recommended tech — ESC: {r.features.electronicStabilityControl || "n/a"} · Forward collision warning:{" "}
            {r.features.forwardCollisionWarning || "n/a"} · Lane departure warning:{" "}
            {r.features.laneDepartureWarning || "n/a"}
          </div>
        </div>
      ))}
    </>
  );
}

function Recalls({ data }: { data: any }) {
  const list: any[] = data.recalls || [];
  if (!list.length) return <p className="muted-note">No recalls found for this model year.</p>;
  return (
    <>
      <p className="muted-note">{list.length} recall campaign{list.length === 1 ? "" : "s"} for this model year.</p>
      {list.map((r) => (
        <div className="info-block" key={r.campaign}>
          <div className="info-title">
            {r.component}
            {r.parkIt && <span className="tag danger">Do not drive</span>}
            {r.parkOutSide && <span className="tag danger">Park outside</span>}
            {r.overTheAir && <span className="tag">Over-the-air fix</span>}
          </div>
          <div className="muted-note">
            Campaign {r.campaign} · Reported {r.reportDate}
          </div>
          <p>{r.summary}</p>
          {r.consequence && <p><strong>Risk:</strong> {r.consequence}</p>}
          {r.remedy && <p><strong>Remedy:</strong> {r.remedy}</p>}
        </div>
      ))}
    </>
  );
}

function Complaints({ data }: { data: any }) {
  if (!data.total) return <p className="muted-note">No owner complaints on file for this model year.</p>;
  return (
    <>
      <p>
        <strong>{data.total.toLocaleString("en-US")}</strong> complaints · {data.crashes} crashes · {data.fires} fires ·{" "}
        {data.injuries} injuries · {data.deaths} deaths reported
      </p>
      <div className="info-title">Most-reported problem areas</div>
      <ul className="plain-list">
        {data.topComponents.map((c: any) => (
          <li key={c.component}>
            {c.component} <span className="muted-note">({c.count})</span>
          </li>
        ))}
      </ul>
      <div className="info-title" style={{ marginTop: 12 }}>Most recent complaints</div>
      {data.recent.map((c: any) => (
        <div className="info-block" key={c.odiNumber}>
          <div className="muted-note">
            ODI {c.odiNumber} · Filed {c.filed} · {c.components}
            {c.crash && " · crash"}
            {c.fire && " · fire"}
          </div>
          <p>{c.summary}</p>
        </div>
      ))}
      <p className="muted-note">Complaints are unverified reports from owners, not confirmed defects.</p>
    </>
  );
}

function Bulletins({ data }: { data: any }) {
  if (!data.loaded) {
    return (
      <p className="muted-note">
        Manufacturer communications aren&apos;t loaded yet. NHTSA publishes these as bulk files rather than an API —
        run <code>scripts/load-mfr-comms.mjs</code> once to import them (see the README note).
      </p>
    );
  }
  const list: any[] = data.items || [];
  if (!list.length) return <p className="muted-note">No manufacturer communications found for this vehicle.</p>;
  return (
    <>
      {list.map((b, i) => (
        <div className="info-block" key={`${b.bulletin}-${i}`}>
          <div className="info-title">{b.component || "General"}</div>
          <div className="muted-note">
            Bulletin {b.bulletin}
            {b.date ? ` · ${b.date}` : ""}
          </div>
          <p>{b.summary}</p>
        </div>
      ))}
    </>
  );
}
