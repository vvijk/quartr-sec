import { expect, test } from "bun:test";
import { createApp } from "./app";
import { SecError } from "./sec";
import type { CompanyFilings } from "../shared/types";

test("filings route passes the ticker to the loader and returns its response", async () => {
  const company: CompanyFilings = { cik: "0000320193", name: "Apple Inc.", historyScope: "recent", filings: [] };
  let tickerReceived = "";
  const app = createApp(async (ticker) => { tickerReceived = ticker; return company; });
  const response = await app.handle(new Request("http://localhost/companies/AAPL/filings"));
  expect(tickerReceived).toBe("AAPL");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(company);
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
