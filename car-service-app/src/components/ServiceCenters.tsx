"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Center = {
  name: string;
  address: string;
  distanceMiles: number;
  lat: number;
  lon: number;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function ServiceCenters({ zip }: { zip: string }) {
  const [centers, setCenters] = useState<Center[] | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

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
      .then((data) => {
        setCenters(data.centers);
        setMapCenter(data.center);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [zip]);

  // Initialize the map once, when we have a token and a container.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5, 39.8], // fallback: center of the US
      zoom: 3,
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers and recenter whenever results change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapCenter) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();

    const homeMarker = new mapboxgl.Marker({ color: "#2563eb" })
      .setLngLat([mapCenter.lon, mapCenter.lat])
      .setPopup(new mapboxgl.Popup().setText(`Zip ${zip}`))
      .addTo(map);
    markersRef.current.push(homeMarker);
    bounds.extend([mapCenter.lon, mapCenter.lat]);

    (centers || []).forEach((c) => {
      const marker = new mapboxgl.Marker({ color: "#dc2626" })
        .setLngLat([c.lon, c.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${c.name}</strong><br/>${c.address}<br/>${c.distanceMiles.toFixed(
              1
            )} mi away`
          )
        )
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([c.lon, c.lat]);
    });

    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 });
  }, [centers, mapCenter, zip]);

  return (
    <div className="card">
      <h2>Nearby service centers</h2>
      {loading && <p className="spinner-text">Searching near {zip}…</p>}
      {error && <p className="error-text">{error}</p>}

      {MAPBOX_TOKEN ? (
        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: 320,
            borderRadius: 10,
            marginBottom: 14,
            overflow: "hidden",
          }}
        />
      ) : (
        <p className="muted-note" style={{ marginBottom: 14 }}>
          Map view unavailable — NEXT_PUBLIC_MAPBOX_TOKEN isn't set.
        </p>
      )}

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
