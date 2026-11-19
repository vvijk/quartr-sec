import { Elysia } from "elysia";
import { fetchCompanyFilings } from "./filings";
import { resolveCik, SecError } from "./sec";
import type { FilingsSummary, PaginatedCompanyFilings } from "../shared/types";
import { summaryWindow, summarizeFilings } from "./summary";

async function loadFilingsFromSec(ticker: string) {
  const cik = await resolveCik(ticker);
  return fetchCompanyFilings(cik);
}

// Accept a loader so route tests can run without contacting SEC.
export function createApp(loadFilings = loadFilingsFromSec) {
  return new Elysia()
    .get("/health", () => ({ status: "ok" }))
    .get("/filings/summary", async ({ query, set }) => {
      const tickers = [
        ...new Set(
          (query.tickers ?? "")
            .split(",")
            .map((ticker) => ticker.trim().toUpperCase()),
        ),
      ];

      if (tickers.some((ticker) => !ticker) || tickers.length > 10) {
        set.status = 400;

        return {
          error: "Provide 1-10 comma-separated tickers, without empty entries.",
        };
      }

      const { from, to } = summaryWindow();
      const result: FilingsSummary = {
        from,
        to,
        historyScope: "recent",
        companies: [],
        errors: [],
      };

      // Process sequentially to avoid sending a burst of company requests.
      for (const ticker of tickers) {
        try {
          const company = await loadFilings(ticker);
          result.companies.push({
            ticker,
            cik: company.cik,
            name: company.name,
            ...summarizeFilings(company.filings, from, to),
          });
        } catch (error) {
          result.errors.push({
            ticker,
            message:
              error instanceof SecError
                ? error.message
                : "Could not load company filings. Please try again.",
          });
        }
      }
      return result;
    })
    .get("/companies/:ticker/filings", async ({ params, query, set }) => {
      const form = query.form?.trim().toUpperCase();
      const sort = query.sort ?? "DESC";
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      const offset = (page - 1) * limit;

      if (sort !== "ASC" && sort !== "DESC") {
        set.status = 400;
        return { error: "sort must be ASC or DESC." };
      }
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        !Number.isSafeInteger(offset)
      ) {
        set.status = 400;
        return {
          error:
            "page and limit must be positive safe integers within a supported range.",
        };
      }

      try {
        const company = await loadFilings(params.ticker);
        const filings = form
          ? company.filings.filter((filing) => filing.form === form)
          : [...company.filings];

        filings.sort((a, b) => {
          const comparison =
            a.filingDate.localeCompare(b.filingDate) ||
            a.accessionNumber.localeCompare(b.accessionNumber);
          return sort === "ASC" ? comparison : -comparison;
        });

        const result: PaginatedCompanyFilings = {
          ...company,
          filings: filings.slice(offset, offset + limit),
          page,
          limit,
          total: filings.length,
          totalPages: Math.ceil(filings.length / limit),
        };
        return result;
      } catch (error) {
        if (error instanceof SecError) {
          switch (error.code) {
            case "INVALID_TICKER":
              set.status = 400;
              break;
            case "UNKNOWN_TICKER":
              set.status = 404;
              break;
            case "SEC_UPSTREAM":
              set.status = 502;
              break;
            default:
              set.status = 500;
          }
          return { error: error.message };
        }
        console.error("Failed to load company filings:", error);
        set.status = 500;
        return { error: "Could not load company filings. Please try again." };
      }
    });
}
