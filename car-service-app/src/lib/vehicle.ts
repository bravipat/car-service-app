// Pure helpers for time-based estimates. No browser APIs, so they can be
// unit-tested in Node.

/** Months until `targetMiles`, assuming a steady annual mileage. */
export function monthsUntil(currentMiles: number, targetMiles: number, annualMiles: number): number {
  if (annualMiles <= 0) return Infinity;
  return Math.max(0, ((targetMiles - currentMiles) / annualMiles) * 12);
}

export function formatEta(months: number): string {
  if (!Number.isFinite(months)) return "";
  if (months < 0.5) return "less than a month away";
  if (months < 1.5) return "~1 month away";
  if (months < 24) return `~${Math.round(months)} months away`;
  const years = months / 12;
  return `~${years.toFixed(years < 10 ? 1 : 0).replace(/\.0$/, "")} years away`;
}

/** Sentence comparing the 5,000-mile mark with the 6-month mark. */
export function intervalComparison(annualMiles: number): string {
  const m = monthsUntil(0, 5000, annualMiles);
  if (!Number.isFinite(m)) return "";
  const rounded = Math.round(m * 10) / 10;
  const mi = `${annualMiles.toLocaleString("en-US")} mi/yr`;
  if (rounded < 6) {
    return `At about ${mi} you'd reach 5,000 miles in ~${rounded} months — so mileage will likely trigger service before the 6-month mark.`;
  }
  if (rounded > 6) {
    return `At about ${mi} you'd need ~${rounded} months to cover 5,000 miles — so the 6-month mark will likely come first.`;
  }
  return `At about ${mi}, 5,000 miles and 6 months arrive at about the same time.`;
}

export function vehicleLabel(v: { year: number; makeName: string; modelName: string }): string {
  return `${v.year} ${v.makeName} ${v.modelName}`;
}
