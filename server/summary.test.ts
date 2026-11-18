import { expect, test } from "bun:test";
import { summaryWindow, summarizeFilings } from "./summary";
import type { Filing, FilingsSummary } from "../shared/types";
import { createApp } from "./app";
import { SecError } from "./sec";

function filing(form: string, filingDate: string): Filing {
  return { form, filingDate, accessionNumber: "fixture", documentUrl: "https://www.sec.gov/fixture" };
}

test("uses a calendar-year UTC window and clamps leap day", () => {
  expect(summaryWindow(new Date("2026-11-18T23:00:00Z"))).toEqual({ from: "2025-11-18", to: "2026-11-18" });
  expect(summaryWindow(new Date("2024-02-29T12:00:00Z"))).toEqual({ from: "2023-02-28", to: "2024-02-29" });
});

test("counts exact forms at inclusive boundaries, excludes old/future records, finds latest 10-K regardless of order", () => {
  const result = summarizeFilings([
    filing("10-K", "2025-12-01"), filing("8-K", "2025-11-18"),
    filing("8-K", "2026-11-18"), filing("8-K", "2025-11-17"),
    filing("10-K/A", "2026-11-01"), filing("10-K", "2024-01-01"),
    filing("10-K", "2027-01-01"), filing("20-F", "2026-02-01"),
  ], "2025-11-18", "2026-11-18");
  expect(result).toEqual({ countsByForm: { "10-K": 1, "8-K": 2, "10-K/A": 1, "20-F": 1 }, latest10KDate: "2025-12-01" });
});

test("latest 10-K can predate the count window; other annual forms are not substituted", () => {
  expect(summarizeFilings([filing("10-K", "2020-01-01")], "2025-11-18", "2026-11-18"))
    .toEqual({ countsByForm: {}, latest10KDate: "2020-01-01" });
  expect(summarizeFilings([filing("20-F", "2026-01-01")], "2025-11-18", "2026-11-18").latest10KDate).toBeNull();
  expect(summarizeFilings([], "2025-11-18", "2026-11-18"))
    .toEqual({ countsByForm: {}, latest10KDate: null });
});

test("summary normalizes/deduplicates tickers and keeps successful companies when another fails", async () => {
  const calls: string[] = [];
  const app = createApp(async (ticker) => {
    calls.push(ticker);
    if (ticker === "BAD") throw new SecError("UNKNOWN_TICKER", "Unknown ticker.");
    return { cik: "0000320193", name: ticker, historyScope: "recent", filings: [] };
  });
  const response = await app.handle(new Request("http://localhost/filings/summary?tickers=%20aapl%20,AAPL,BAD,SPOT"));
  const result = await response.json() as FilingsSummary;
  expect(response.status).toBe(200);
  expect(calls).toEqual(["AAPL", "BAD", "SPOT"]);
  expect(result.companies.map((company) => company.ticker)).toEqual(["AAPL", "SPOT"]);
  expect(result.errors).toEqual([{ ticker: "BAD", message: "Unknown ticker." }]);
  expect(result.historyScope).toBe("recent");
});

test("summary rejects missing, empty, and oversized company sets without fetching", async () => {
  let calls = 0;
  const app = createApp(async () => { calls++; throw new Error("Must not fetch"); });
  for (const query of ["", "?tickers=", "?tickers=AAPL,", "?tickers=" + Array.from({ length: 11 }, (_, i) => `T${i}`).join(",")]) {
    expect((await app.handle(new Request(`http://localhost/filings/summary${query}`))).status).toBe(400);
  }
  expect(calls).toBe(0);
});

test("all-company failure returns errors rather than fabricated zero counts", async () => {
  const app = createApp(async () => { throw new SecError("SEC_UPSTREAM", "SEC unavailable."); });
  const response = await app.handle(new Request("http://localhost/filings/summary?tickers=AAPL"));
  const result = await response.json() as FilingsSummary;
  expect(response.status).toBe(200);
  expect(result.companies).toEqual([]);
  expect(result.errors).toEqual([{ ticker: "AAPL", message: "SEC unavailable." }]);
});
