import type { Filing } from "../shared/types";

export function summaryWindow(now = new Date()) {
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  // February 29 becomes February 28 when the previous year is not a leap year.
  if (from.getUTCMonth() !== now.getUTCMonth()) from.setUTCDate(0);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function summarizeFilings(filings: Filing[], from: string, to: string) {
  const counts = new Map<string, number>();
  let latest10KDate: string | null = null;

  for (const filing of filings) {
    if (filing.filingDate > to) continue;

    if (filing.filingDate >= from) {
      counts.set(filing.form, (counts.get(filing.form) ?? 0) + 1);
    }
    // Latest 10-K is independent of the 12-month counting window.
    if (
      filing.form === "10-K" &&
      (latest10KDate === null || filing.filingDate > latest10KDate)
    ) {
      latest10KDate = filing.filingDate;
    }
  }

  return { countsByForm: Object.fromEntries(counts), latest10KDate };
}
