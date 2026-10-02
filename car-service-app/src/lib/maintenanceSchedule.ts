// Static maintenance schedule, based on general manufacturer guidance.
// This is intentionally not vehicle-specific — it's the same baseline
// schedule for every make/model, per the requirements this app was built
// against. Treat it as a helpful reminder list, not a substitute for the
// owner's manual.

export type RecurringItem = {
  kind: "recurring";
  intervalMiles: number;
  label: string;
  items: string[];
};

export type MilestoneItem = {
  kind: "milestone";
  atMiles: number;
  label: string;
  items: string[];
};

export type ScheduleEntry = RecurringItem | MilestoneItem;

export const MAINTENANCE_SCHEDULE: ScheduleEntry[] = [
  {
    kind: "recurring",
    intervalMiles: 5000,
    label: "Every 5,000 miles",
    items: ["Oil and oil filter change (if using conventional oil)"],
  },
  {
    kind: "recurring",
    intervalMiles: 10000,
    label: "Every 10,000 miles",
    items: [
      "Rotate tires",
      "Oil change (if using synthetic oil)",
      "Inspect, and if necessary change, the cabin air filter and engine air filter",
    ],
  },
  {
    kind: "milestone",
    atMiles: 36000,
    label: "At 36,000 miles",
    items: [
      "Full mechanical inspection — do this just before the typical 3-year comprehensive warranty expires so any necessary repairs can be covered by the manufacturer",
    ],
  },
  {
    kind: "milestone",
    atMiles: 50000,
    label: "At 50,000 miles",
    items: [
      "Replace brake pads and fuel filter",
      "Drain and replace transmission fluid and filter",
      "Inspect exhaust, emissions, and suspension systems",
    ],
  },
  {
    kind: "milestone",
    atMiles: 60000,
    label: "At 60,000 miles",
    items: [
      "Replace spark plugs",
      "Change tires",
      "Inspect belts, hoses, and valves (if equipped with a timing belt, change per the automaker's recommendation to avoid engine damage)",
    ],
  },
  {
    kind: "milestone",
    atMiles: 100000,
    label: "At 100,000 miles",
    items: [
      "Change high-mileage coolant and 100,000-mile spark plugs (if so equipped)",
      "Full mechanical inspection",
    ],
  },
  {
    kind: "milestone",
    atMiles: 125000,
    label: "At 125,000 miles",
    items: [
      "Change O2 sensors, coolant, and brake fluid",
      "Inspect the air conditioning compressor and belt tensioner",
      "Replace shocks and struts and get a wheel alignment",
    ],
  },
  {
    kind: "milestone",
    atMiles: 180000,
    label: "At 180,000 miles",
    items: [
      "Change the power steering fluid",
      "Clean the airflow sensor",
      "Inspect seals on axles and driveshafts, and replace if leaking",
      "Inspect the timing chain (if so equipped) and engine/transmission mounts",
    ],
  },
  {
    kind: "milestone",
    atMiles: 250000,
    label: "At 250,000 miles",
    items: [
      "Clean fuel injectors",
      "Inspect the chassis",
      "Check the catalytic converter for damage",
    ],
  },
];

export type ScheduleStatus = "due" | "upcoming";

export type ScheduleResult = {
  label: string;
  items: string[];
  status: ScheduleStatus;
  triggerMiles: number; // the mileage this entry is anchored to
};

// A milestone/interval is considered "due" once current mileage has reached
// it (within a small look-back window, so it doesn't disappear the instant
// you pass it), and "upcoming" if it falls within the next LOOKAHEAD miles.
const DUE_LOOKBACK_MILES = 1000;
const LOOKAHEAD_MILES = 5000;

export function getServiceStatus(currentMileage: number): ScheduleResult[] {
  const results: ScheduleResult[] = [];

  for (const entry of MAINTENANCE_SCHEDULE) {
    if (entry.kind === "recurring") {
      const interval = entry.intervalMiles;
      const lastOccurrence = Math.floor(currentMileage / interval) * interval;
      const nextOccurrence = lastOccurrence + interval;

      const distanceSinceLast = currentMileage - lastOccurrence;
      if (lastOccurrence > 0 && distanceSinceLast <= DUE_LOOKBACK_MILES) {
        results.push({
          label: entry.label,
          items: entry.items,
          status: "due",
          triggerMiles: lastOccurrence,
        });
      } else if (nextOccurrence - currentMileage <= LOOKAHEAD_MILES) {
        results.push({
          label: entry.label,
          items: entry.items,
          status: "upcoming",
          triggerMiles: nextOccurrence,
        });
      }
    } else {
      const distancePast = currentMileage - entry.atMiles;
      if (distancePast >= 0 && distancePast <= DUE_LOOKBACK_MILES) {
        results.push({
          label: entry.label,
          items: entry.items,
          status: "due",
          triggerMiles: entry.atMiles,
        });
      } else if (
        distancePast < 0 &&
        entry.atMiles - currentMileage <= LOOKAHEAD_MILES
      ) {
        results.push({
          label: entry.label,
          items: entry.items,
          status: "upcoming",
          triggerMiles: entry.atMiles,
        });
      }
    }
  }

  return results.sort((a, b) => a.triggerMiles - b.triggerMiles);
}

export function computeNextServiceDue(
  currentMileage: number,
  lastServiceDate: string // ISO date string, e.g. "2026-03-01"
): { mileageTarget: number; dateTarget: string; summary: string } {
  const mileageTarget = currentMileage + 5000;

  const last = new Date(lastServiceDate + "T00:00:00");
  const dateTargetObj = new Date(last);
  dateTargetObj.setMonth(dateTargetObj.getMonth() + 6);
  const dateTarget = dateTargetObj.toISOString().slice(0, 10);

  const formattedDate = dateTargetObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const summary = `Next service due at ${mileageTarget.toLocaleString()} miles or by ${formattedDate} — whichever comes first.`;

  return { mileageTarget, dateTarget, summary };
}
