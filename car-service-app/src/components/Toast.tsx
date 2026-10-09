"use client";

export type ToastKind = "success" | "error";
export type Toast = { id: number; kind: ToastKind; message: string };

// Small notification stack, bottom of the screen. Screen readers hear new
// toasts because the container is an aria-live region.
export default function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toast-host no-print" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <span className="toast-icon" aria-hidden="true">
            {t.kind === "success" ? "✓" : "!"}
          </span>
          <span className="toast-msg">{t.message}</span>
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
