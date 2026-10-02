"use client";

import { useEffect, useState } from "react";

type Center = {
  name: string;
  address: string;
  distanceMiles: number;
};

export default function ServiceCenters({ zip }: { zip: string }) {
  const [centers, setCenters] = useState<Center[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/service-centers?zip=${zip}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Lookup failed");
        }
        return r.json();
      })
      .then((data) => setCenters(data.centers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [zip]);

  return (
    <div className="card">
      <h2>Nearby service centers</h2>
      {loading && <p className="spinner-text">Searching near {zip}…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && centers && centers.length === 0 && (
        <p className="muted-note">
          No auto repair shops found within about 10 miles of {zip} in the
          OpenStreetMap dataset.
        </p>
      )}
      {!loading &&
        !error &&
        centers &&
        centers.map((c, i) => (
          <div className="center-item" key={i}>
            <div className="center-name">{c.name}</div>
            <div className="center-address">{c.address}</div>
            <div className="center-distance">
              {c.distanceMiles.toFixed(1)} miles away
            </div>
          </div>
        ))}
      <p className="muted-note">
        Locations sourced from OpenStreetMap community data — coverage varies
        by area.
      </p>
    </div>
  );
}
