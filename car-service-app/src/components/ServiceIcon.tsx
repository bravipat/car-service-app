// Small line icons for maintenance items, picked from the item's wording.

type Kind = "oil" | "tire" | "brake" | "filter" | "engine" | "wrench";

export function iconKind(text: string): Kind {
  const t = text.toLowerCase();
  if (/\boil\b/.test(t)) return "oil";
  if (/tire|alignment|wheel/.test(t)) return "tire";
  if (/brake/.test(t)) return "brake";
  if (/filter|air condition/.test(t)) return "filter";
  if (/spark|engine|timing|belt|o2|injector|catalytic|coolant|airflow/.test(t)) return "engine";
  return "wrench";
}

const PATHS: Record<Kind, React.ReactNode> = {
  oil: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  tire: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </>
  ),
  brake: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M6.5 6.5a8 8 0 0 1 11 0" />
    </>
  ),
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  engine: (
    <>
      <rect x="5" y="8" width="14" height="9" rx="2" />
      <path d="M9 8V5h6v3M3 11v3M21 11v3M9 17v2M15 17v2" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" />,
};

export default function ServiceIcon({ text }: { text: string }) {
  const kind = iconKind(text);
  return (
    <span className="item-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[kind]}
      </svg>
    </span>
  );
}
