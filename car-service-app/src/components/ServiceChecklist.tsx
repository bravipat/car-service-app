import type { ScheduleResult } from "@/lib/maintenanceSchedule";

export default function ServiceChecklist({
  nextDueSummary,
  schedule,
}: {
  nextDueSummary: string;
  schedule: ScheduleResult[];
}) {
  return (
    <div className="card">
      <h2>Your maintenance schedule</h2>
      <div className="next-due-banner">{nextDueSummary}</div>

      <div style={{ marginTop: 16 }}>
        {schedule.length === 0 && (
          <p className="muted-note">
            Nothing due or coming up within the next 5,000 miles.
          </p>
        )}
        {schedule.map((entry, i) => (
          <div
            key={i}
            className={`schedule-item ${entry.status === "due" ? "due" : "upcoming"}`}
          >
            <span className="badge">
              {entry.status === "due" ? "Due now" : "Coming up"}
            </span>
            <div>
              <strong>{entry.label}</strong>{" "}
              <span className="muted-note">
                (at {entry.triggerMiles.toLocaleString()} mi)
              </span>
            </div>
            <ul>
              {entry.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
