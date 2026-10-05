"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Place = {
  name: string;
  address: string;
  distanceMiles: number;
  lat: number;
  lon: number;
  phone?: string;
  mobile?: boolean;
};

type LatLon = { lat: number; lon: number };
type Tab = "shops" | "seats";
type Loaded = { places: Place[]; center: LatLon | null };

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const TABS: { id: Tab; label: string; color: string; empty: string; credit: string }[] = [
  {
    id: "shops",
    label: "Repair shops",
    color: "#dc2626",
    empty: "No auto repair shops found within about 10 miles in the OpenStreetMap dataset.",
    credit: "Locations sourced from OpenStreetMap community data — coverage varies by area.",
  },
  {
    id: "seats",
    label: "Car seat inspection",
    color: "#16a34a",
    empty: "No NHTSA car seat inspection stations found within 25 miles.",
    credit: "Child car seat inspection stations from NHTSA. Call ahead — many are by appointment.",
  },
];

// Build popup content with DOM nodes + textContent. Shop names come from
// community-edited OpenStreetMap data, so they must never be injected as HTML.
function popupNode(p: Place): HTMLElement {
  const root = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = p.name;
  root.appendChild(name);
  const lines = [p.address, p.phone, `${p.distanceMiles.toFixed(1)} mi away`];
  for (const line of lines) {
    if (!line) continue;
    root.appendChild(document.createElement("br"));
    root.appendChild(document.createTextNode(line));
  }
  return root;
}

function validCoord(p: Place) {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

function centroid(places: Place[]): LatLon | null {
  const pts = places.filter(validCoord);
  if (!pts.length) return null;
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length,
  };
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Lookup failed");
  return body;
}

export default function ServiceCenters({ zip }: { zip: string }) {
  const [tab, setTab] = useState<Tab>("shops");
  const [data, setData] = useState<Partial<Record<Tab, Loaded>>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<Tab, string>>>({});
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const homeRef = useRef<mapboxgl.Marker | null>(null);

  // Load both lists for this zip.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors({});
    setData({});

    const load = async (t: Tab, url: string, key: "centers" | "stations") => {
      try {
        const body = await getJson(url);
        const places: Place[] = Array.isArray(body[key]) ? body[key] : [];
        if (!cancelled) setData((d) => ({ ...d, [t]: { places, center: body.center ?? null } }));
      } catch (e: any) {
        if (!cancelled) setErrors((er) => ({ ...er, [t]: e.message || "Lookup failed" }));
      }
    };

    Promise.all([
      load("shops", `/api/service-centers?zip=${zip}`, "centers"),
      load("seats", `/api/nhtsa/car-seats?zip=${zip}`, "stations"),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [zip]);

  // Create the map once.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5, 39.8],
      zoom: 3,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.resize(); // the container can be measured before layout settles
      setMapReady(true);
    });
    map.on("error", (e) => {
      const msg = String((e as any)?.error?.message || "");
      if (/401|403|token|access/i.test(msg)) {
        setMapError("Mapbox rejected the access token — check NEXT_PUBLIC_MAPBOX_TOKEN and its URL restrictions.");
      }
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      homeRef.current = null;
      setMapReady(false);
    };
  }, []);

  const current = data[tab];
  const places = current?.places ?? [];
  const tabMeta = TABS.find((t) => t.id === tab)!;
  // Prefer the server-provided centre, but never depend on it for the pins.
  const mapCenter: LatLon | null =
    data.shops?.center ?? data.seats?.center ?? centroid(places);

  // Draw pins whenever the map is ready or the visible list changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    homeRef.current?.remove();
    homeRef.current = null;

    const bounds = new mapboxgl.LngLatBounds();
    let count = 0;

    if (mapCenter) {
      homeRef.current = new mapboxgl.Marker({ color: "#2563eb" })
        .setLngLat([mapCenter.lon, mapCenter.lat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setText(`Zip ${zip}`))
        .addTo(map);
      bounds.extend([mapCenter.lon, mapCenter.lat]);
      count++;
    }

    places.forEach((p) => {
      if (!validCoord(p)) {
        markersRef.current.push(null as unknown as mapboxgl.Marker); // keep indexes aligned with the list
        return;
      }
      const marker = new mapboxgl.Marker({ color: tabMeta.color })
        .setLngLat([p.lon, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setDOMContent(popupNode(p)))
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([p.lon, p.lat]);
      count++;
    });

    if (count > 0) map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, data, tab, zip]);

  function focusPlace(i: number) {
    const map = mapRef.current;
    const marker = markersRef.current[i];
    const p = places[i];
    if (!map || !marker || !p) return;
    map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 14), duration: 600 });
    markersRef.current.forEach((m) => m?.getPopup()?.isOpen() && m.togglePopup());
    marker.togglePopup();
    mapContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const error = errors[tab];

  return (
    <div className="card" data-print-hide>
      <h2>Nearby help</h2>

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
            {data[t.id] ? ` (${data[t.id]!.places.length})` : ""}
          </button>
        ))}
      </div>

      {loading && <p className="spinner-text">Searching near {zip}…</p>}

      {MAPBOX_TOKEN ? (
        <div
          ref={mapContainerRef}
          style={{ width: "100%", height: 320, borderRadius: 10, margin: "12px 0 14px", overflow: "hidden" }}
        />
      ) : (
        <p className="muted-note" style={{ margin: "12px 0 14px" }}>
          Map view unavailable — NEXT_PUBLIC_MAPBOX_TOKEN isn&apos;t set.
        </p>
      )}
      {mapError && <p className="error-text">{mapError}</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && current && places.length === 0 && (
        <p className="muted-note">{tabMeta.empty}</p>
      )}

      {!error &&
        places.map((p, i) => (
          <div
            className="center-item"
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => focusPlace(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && focusPlace(i)}
          >
            <div className="center-name">
              <span className="dot" style={{ background: tabMeta.color }} />
              {p.name}
              {p.mobile ? " (mobile station)" : ""}
            </div>
            <div className="center-address">{p.address}</div>
            {p.phone && <div className="center-address">{p.phone}</div>}
            <div className="center-distance">{p.distanceMiles.toFixed(1)} miles away</div>
          </div>
        ))}

      <p className="muted-note">{tabMeta.credit}</p>
    </div>
  );
}
