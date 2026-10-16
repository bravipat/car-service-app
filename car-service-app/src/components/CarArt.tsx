"use client";

import { useRef, useState } from "react";

// A thin-line, pointer-responsive "exploded" car. Moving across the figure opens
// the gaps between its layers; moving down picks a layer and the caption says
// which maintenance topics it covers. Drawn from scratch, no dependencies.

const LAYERS = [
  { title: "Glass & lights", text: "Wipers, washer fluid, bulbs and visibility checks." },
  { title: "Body & engine bay", text: "Oil, filters, fluids, belts and spark plugs." },
  { title: "Wheels & brakes", text: "Tire rotation, alignment, brake pads and rotors." },
] as const;

const REST = 0.16; // how far the layers sit apart when nobody is pointing

export default function CarArt() {
  const fig = useRef<HTMLDivElement | null>(null);
  const [pick, setPick] = useState<number | null>(null);

  function setOpen(v: number) {
    fig.current?.style.setProperty("--open", Math.min(1, Math.max(0, v)).toFixed(3));
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    setOpen(0.2 + 0.8 * nx);
    setPick(Math.min(2, Math.max(0, Math.floor(ny * 3))));
  }

  function onLeave() {
    setOpen(REST);
    setPick(null);
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    setOpen(0.75);
    setPick((p) => {
      const cur = p ?? (e.key === "ArrowDown" ? -1 : 3);
      return Math.min(2, Math.max(0, cur + (e.key === "ArrowDown" ? 1 : -1)));
    });
  }

  const on = (i: number) => (pick === i ? "layer on" : "layer");

  return (
    <figure className="car-fig" ref={fig}>
      <div
        className="car-stage"
        tabIndex={0}
        role="img"
        aria-label="Line drawing of a car that opens into layers: glass and lights, body and engine bay, wheels and brakes. Use the up and down arrow keys to pick a layer."
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={onLeave}
        onFocus={() => setOpen(0.6)}
        onBlur={onLeave}
        onKeyDown={onKey}
      >
        <svg className="car-art" viewBox="0 20 400 180" aria-hidden="true" focusable="false">
          {/* wheels + road (bottom layer) */}
          <g className={`${on(2)} wheels`}>
            <line className="road" x1="6" y1="160" x2="394" y2="160" />
            <circle className="tyre" cx="100" cy="136" r="24" />
            <circle className="tyre" cx="300" cy="136" r="24" />
            <g className="wheel-spin">
              <circle className="hub" cx="100" cy="136" r="10" />
              <path className="spokes" d="M100 118v36M82 136h36M87 123l26 26M113 123l-26 26" />
            </g>
            <g className="wheel-spin">
              <circle className="hub" cx="300" cy="136" r="10" />
              <path className="spokes" d="M300 118v36M282 136h36M287 123l26 26M313 123l-26 26" />
            </g>
          </g>

          {/* body shell (middle layer) */}
          <g className={`${on(1)} body`}>
            <path
              className="shell"
              d="M30 120 C30 110 40 106 58 104 L100 100 C118 78 140 66 172 66 L236 66 C262 66 282 80 300 100 L344 106 C362 108 372 114 372 126 L372 136 L30 136 Z"
            />
            <path className="detail" d="M201 74 L201 134 M180 108 L192 108 M222 108 L234 108" />
          </g>

          {/* glass + lights (top layer) */}
          <g className={`${on(0)} glass`}>
            <path className="pane" d="M112 100 C126 82 142 74 168 74 L196 74 L196 100 Z" />
            <path className="pane" d="M206 74 L236 74 C254 74 268 84 282 100 L206 100 Z" />
            <rect className="head" x="358" y="114" width="14" height="8" rx="3" />
            <rect className="tail" x="30" y="114" width="12" height="8" rx="3" />
          </g>
        </svg>
      </div>
      <figcaption className="car-cap" aria-live="polite">
        {pick === null ? (
          <>
            <b>Try it</b> Move across to open the car up. Move down to pick a layer.
          </>
        ) : (
          <>
            <b>{LAYERS[pick].title}</b> {LAYERS[pick].text}
          </>
        )}
      </figcaption>
    </figure>
  );
}
