// Original line illustration of a generic sedan, drawn in the brand's mint
// colour. Decorative only, so it is hidden from screen readers.

export default function CarArt() {
  return (
    <svg className="car-art" viewBox="0 0 400 176" aria-hidden="true" focusable="false">
      {/* road */}
      <line className="road" x1="6" y1="160" x2="394" y2="160" />
      {/* body */}
      <path
        className="body"
        d="M30 120 C30 110 40 106 58 104 L100 100 C118 78 140 66 172 66 L236 66 C262 66 282 80 300 100 L344 106 C362 108 372 114 372 126 L372 136 L30 136 Z"
      />
      {/* windows */}
      <path className="glass" d="M112 100 C126 82 142 74 168 74 L196 74 L196 100 Z" />
      <path className="glass" d="M206 74 L236 74 C254 74 268 84 282 100 L206 100 Z" />
      {/* door line + handle */}
      <path className="detail" d="M201 74 L201 134 M180 108 L192 108 M222 108 L234 108" />
      {/* lights */}
      <rect className="head" x="358" y="114" width="14" height="8" rx="3" />
      <rect className="tail" x="30" y="114" width="12" height="8" rx="3" />
      {/* wheels */}
      <g>
        <circle className="tyre" cx="100" cy="136" r="24" />
        <g className="wheel-spin">
          <circle className="hub" cx="100" cy="136" r="10" />
          <path className="spokes" d="M100 118v36M82 136h36M87 123l26 26M113 123l-26 26" />
        </g>
      </g>
      <g>
        <circle className="tyre" cx="300" cy="136" r="24" />
        <g className="wheel-spin">
          <circle className="hub" cx="300" cy="136" r="10" />
          <path className="spokes" d="M300 118v36M282 136h36M287 123l26 26M313 123l-26 26" />
        </g>
      </g>
    </svg>
  );
}
