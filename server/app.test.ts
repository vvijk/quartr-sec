import { expect, test } from "bun:test";
import { createApp } from "./app";
import { SecError } from "./sec";
import type { CompanyFilings, PaginatedCompanyFilings } from "../shared/types";

test("filings route passes the ticker to the loader and returns its response", async () => {
  const company: CompanyFilings = { cik: "0000320193", name: "Apple Inc.", historyScope: "recent", filings: [] };
  let tickerReceived = "";
  const app = createApp(async (ticker) => { tickerReceived = ticker; return company; });
  const response = await app.handle(new Request("http://localhost/companies/AAPL/filings"));
  expect(tickerReceived).toBe("AAPL");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ...company, page: 1, limit: 20, total: 0, totalPages: 0 });
});

const sampleCompany: CompanyFilings = {
  cik: "0000320193", name: "Apple Inc.", historyScope: "recent",
  filings: [
    { accessionNumber: "C", form: "10-K", filingDate: "2025-03-01", documentUrl: "https://www.sec.gov/c" },
    { accessionNumber: "A", form: "8-K", filingDate: "2025-01-01", documentUrl: "https://www.sec.gov/a" },
    { accessionNumber: "D", form: "10-K/A", filingDate: "2025-04-01", documentUrl: "https://www.sec.gov/d" },
    { accessionNumber: "B", form: "10-K", filingDate: "2025-02-01", documentUrl: "https://www.sec.gov/b" },
    { accessionNumber: "E", form: "10-K", filingDate: "2025-03-01", documentUrl: "https://www.sec.gov/e" },
  ],
};

test("filters and sorts before pagination, with filtered totals and deterministic ties", async () => {
  const original = structuredClone(sampleCompany);
  const app = createApp(async () => sampleCompany);
  for (const [sort, expected] of [["ASC", "B"], ["DESC", "E"]] as const) {
    const response = await app.handle(new Request(`http://localhost/companies/AAPL/filings?form=10-k&sort=${sort}&page=1&limit=1`));
    const body = await response.json() as PaginatedCompanyFilings;
    expect(body.filings.map((filing: { accessionNumber: string }) => filing.accessionNumber)).toEqual([expected]);
    expect(body).toMatchObject({ page: 1, limit: 1, total: 3, totalPages: 3 });
  }
  expect(sampleCompany).toEqual(original);
  const secondPage = await app.handle(new Request("http://localhost/companies/AAPL/filings?form=10-K&sort=ASC&page=2&limit=2"));
  expect(await secondPage.json()).toMatchObject({
    page: 2, limit: 2, total: 3, totalPages: 2, filings: [sampleCompany.filings[4]],
  });
});

test("defaults to page one, twenty records, and newest first", async () => {
  const company = { ...sampleCompany, filings: Array.from({ length: 25 }, (_, index) => ({
    ...sampleCompany.filings[0]!, accessionNumber: String(index).padStart(2, "0"),
    filingDate: `2025-01-${String(index + 1).padStart(2, "0")}`,
  })) };
  const response = await createApp(async () => company).handle(new Request("http://localhost/companies/AAPL/filings"));
  const body = await response.json() as PaginatedCompanyFilings;
  expect(body).toMatchObject({ page: 1, limit: 20, total: 25, totalPages: 2 });
  expect(body.filings).toHaveLength(20);
  expect(body.filings[0]?.filingDate).toBe("2025-01-25");
  expect(body.filings[19]?.filingDate).toBe("2025-01-06");
});

test("returns empty pages for no matches or pages beyond the results", async () => {
  const app = createApp(async () => sampleCompany);
  for (const query of ["form=20-F", "page=99"]) {
    const response = await app.handle(new Request(`http://localhost/companies/AAPL/filings?${query}`));
    expect(response.status).toBe(200);
    const body = await response.json() as PaginatedCompanyFilings;
    expect(body.filings).toEqual([]);
    expect(body.total).toBe(query.startsWith("form") ? 0 : 5);
  }
});

test("rejects invalid query values before loading SEC data", async () => {
  let calls = 0;
  const app = createApp(async () => { calls++; return sampleCompany; });
  for (const query of ["sort=wrong", "sort=", "page=0", "page=-1", "page=1.5", "page=no", "limit=0", "limit=", "limit=Infinity", "page=9007199254740992"]) {
    const response = await app.handle(new Request(`http://localhost/companies/AAPL/filings?${query}`));
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toBeString();
  }
  expect(calls).toBe(0);
});

test("filings route maps known errors to HTTP statuses and JSON messages", async () => {
  const cases = [
    ["INVALID_TICKER", 400], ["UNKNOWN_TICKER", 404], ["SEC_UPSTREAM", 502], ["SEC_CONFIG", 500],
  ] as const;
  for (const [code, status] of cases) {
    const app = createApp(async () => { throw new SecError(code, "Example error"); });
    const response = await app.handle(new Request("http://localhost/companies/AAPL/filings"));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Example error" });
  }
});
