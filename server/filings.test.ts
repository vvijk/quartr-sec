import { expect, mock, test } from "bun:test";
import { fetchCompanyFilings, transformFilings } from "./filings";
import { createTickerResolver } from "./sec";

const cik = "0000320193";
const userAgent = "TestApp test@example.com";
const columns = {
  accessionNumber: ["0000320193-26-000010", "0000320193-25-000020"],
  form: ["8-K", "10-K/A"],
  filingDate: ["2026-11-10", "2025-10-30"],
  primaryDocument: ["apple.htm", "xslF345X05/ownership.xml"],
};
const submissions = {
  cik: 320193,
  name: "Apple Inc.",
  filings: { recent: columns, files: [{ name: "older-history.json" }] },
};

test("transforms columns without changing order or form names and builds document URLs", () => {
  expect(transformFilings(columns, cik)).toEqual([
    { accessionNumber: "0000320193-26-000010", form: "8-K", filingDate: "2026-11-10",
      documentUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000010/apple.htm" },
    { accessionNumber: "0000320193-25-000020", form: "10-K/A", filingDate: "2025-10-30",
      documentUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019325000020/xslF345X05/ownership.xml" },
  ]);
});

test("supports an empty filing history", () => {
  expect(transformFilings({ accessionNumber: [], form: [], filingDate: [], primaryDocument: [] }, cik)).toEqual([]);
});

test("uses complete submission text for an empty primary document and encodes filenames", () => {
  const result = transformFilings({ ...columns, primaryDocument: ["", "a b#c.htm"] }, cik);
  expect(result[0]?.documentUrl).toEndWith("/0000320193-26-000010.txt");
  expect(result[1]?.documentUrl).toEndWith("/a%20b%23c.htm");
});

test("rejects missing, misaligned, or malformed columns instead of returning partial data", () => {
  for (const data of [
    null, {}, { ...columns, form: ["8-K"] }, { ...columns, primaryDocument: undefined },
    { ...columns, form: [null, "10-K"] }, { ...columns, accessionNumber: ["bad", columns.accessionNumber[1]] },
    { ...columns, form: [" ", "10-K"] },
    { ...columns, accessionNumber: ["---", columns.accessionNumber[1]] },
    { ...columns, filingDate: ["not a date", "2025-10-30"] },
    { ...columns, filingDate: ["2026-02-30", "2025-10-30"] },
    { ...columns, primaryDocument: ["../bad.htm", "good.htm"] },
  ]) {
    expect(() => transformFilings(data, cik)).toThrow();
  }
});

test("uses the resolved CIK to fetch and normalize the main submissions response only", async () => {
  const fetcher = mock(async (url: string | URL | Request) => {
    if (String(url).endsWith("company_tickers.json")) {
      return Response.json({ "0": { cik_str: 320193, ticker: "AAPL" } });
    }
    return Response.json(submissions);
  }) as unknown as typeof fetch;
  const resolve = createTickerResolver(userAgent, fetcher);
  const result = await fetchCompanyFilings(await resolve("aapl"), userAgent, fetcher);
  expect(result).toEqual({ cik, name: "Apple Inc.", historyScope: "recent", filings: transformFilings(columns, cik) });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher).toHaveBeenLastCalledWith(
    "https://data.sec.gov/submissions/CIK0000320193.json",
    expect.objectContaining({ headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: expect.any(AbortSignal) }),
  );
});

test("rejects invalid CIKs before making requests", async () => {
  const fetcher = mock(async () => Response.json(submissions)) as unknown as typeof fetch;
  for (const input of ["320193", "0000000000", "../invalid", "0000032e03", " 000320193"]) {
    await expect(fetchCompanyFilings(input, userAgent, fetcher)).rejects.toMatchObject({ code: "INVALID_CIK" });
  }
  expect(fetcher).not.toHaveBeenCalled();
});

test("rejects invalid company envelopes and wrong-company responses", async () => {
  for (const data of [null, {}, { ...submissions, cik: 1 }, { ...submissions, filings: {} }]) {
    const fetcher = mock(async () => Response.json(data)) as unknown as typeof fetch;
    await expect(fetchCompanyFilings(cik, userAgent, fetcher)).rejects.toMatchObject({ code: "SEC_UPSTREAM" });
  }
});

test("reports HTTP, network, timeout, and invalid JSON failures", async () => {
  for (const handler of [
    async () => new Response("Unavailable", { status: 503 }),
    async (): Promise<Response> => { throw new Error("Network error"); },
    async (): Promise<Response> => { throw new DOMException("Timeout", "TimeoutError"); },
    async () => new Response("not JSON"),
  ]) {
    await expect(fetchCompanyFilings(cik, userAgent, mock(handler) as unknown as typeof fetch))
      .rejects.toMatchObject({ code: "SEC_UPSTREAM" });
  }
});
