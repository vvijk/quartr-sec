import { expect, mock, test } from "bun:test";
import { createTickerResolver } from "./sec";

const fixture = {
  "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
  "1": { cik_str: 1067983, ticker: "BRK-B", title: "Berkshire Hathaway Inc." },
};

function fakeFetch(handler: () => Promise<Response>) {
  return mock(handler) as unknown as typeof fetch;
}

test("normalizes input, pads CIKs, and shares a cached download", async () => {
  const fetcher = fakeFetch(async () => Response.json(fixture));
  const resolve = createTickerResolver("TestApp test@example.com", fetcher);

  expect(await Promise.all([resolve(" aapl "), resolve("brk-b")])).toEqual([
    "0000320193", "0001067983",
  ]);
  expect(await resolve("AAPL")).toBe("0000320193");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    "https://www.sec.gov/files/company_tickers.json",
    expect.objectContaining({
      headers: { "User-Agent": "TestApp test@example.com", Accept: "application/json" },
      signal: expect.any(AbortSignal),
    }),
  );
  await expect(resolve("MISSING")).rejects.toMatchObject({ code: "UNKNOWN_TICKER" });
});

test("rejects invalid input before fetching", async () => {
  const fetcher = fakeFetch(async () => Response.json(fixture));
  const resolve = createTickerResolver("TestApp test@example.com", fetcher);
  for (const ticker of ["", "   ", "AAPL/MSFT", "A A", "A".repeat(33)]) {
    await expect(resolve(ticker)).rejects.toMatchObject({ code: "INVALID_TICKER" });
  }
  expect(fetcher).not.toHaveBeenCalled();
});

test("requires an identifying user agent", async () => {
  const fetcher = fakeFetch(async () => Response.json(fixture));
  await expect(createTickerResolver(undefined, fetcher)("AAPL"))
    .rejects.toMatchObject({ code: "SEC_CONFIG" });
  expect(fetcher).not.toHaveBeenCalled();
});

test("does not cache upstream failures", async () => {
  let attempts = 0;
  const fetcher = fakeFetch(async () => ++attempts === 1
    ? new Response("Rate limited", { status: 429 })
    : Response.json(fixture));
  const resolve = createTickerResolver("TestApp test@example.com", fetcher);
  await expect(resolve("AAPL")).rejects.toMatchObject({ code: "SEC_UPSTREAM" });
  expect(await resolve("AAPL")).toBe("0000320193");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("rejects malformed SEC data", async () => {
  for (const data of [null, [], {}, { "0": { ticker: "AAPL", cik_str: "320193" } }]) {
    const resolve = createTickerResolver("TestApp test@example.com", fakeFetch(async () => Response.json(data)));
    await expect(resolve("AAPL")).rejects.toMatchObject({ code: "SEC_UPSTREAM" });
  }
});

test("reports network and invalid JSON failures as upstream errors", async () => {
  for (const handler of [
    async (): Promise<Response> => { throw new Error("Network unavailable"); },
    async () => new Response("not json"),
  ]) {
    const resolve = createTickerResolver("TestApp test@example.com", fakeFetch(handler));
    await expect(resolve("AAPL")).rejects.toMatchObject({ code: "SEC_UPSTREAM" });
  }
});
