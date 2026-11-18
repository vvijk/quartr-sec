import { Elysia } from "elysia";
import { fetchCompanyFilings } from "./filings";
import { resolveCik, SecError } from "./sec";
import type { PaginatedCompanyFilings } from "../shared/types";

// Accept a loader so route tests can run without contacting SEC.
export function createApp(
  loadFilings = async (ticker: string) => fetchCompanyFilings(await resolveCik(ticker)),
) {
  return new Elysia()
    .get("/health", () => ({ status: "ok" }))
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
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset)) {
        set.status = 400;
        return { error: "page and limit must be positive safe integers within a supported range." };
      }

      try {
        const company = await loadFilings(params.ticker);
        const filings = form
          ? company.filings.filter((filing) => filing.form === form)
          : [...company.filings];

        filings.sort((a, b) => {
          const comparison = a.filingDate.localeCompare(b.filingDate)
            || a.accessionNumber.localeCompare(b.accessionNumber);
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
            case "INVALID_TICKER": set.status = 400; break;
            case "UNKNOWN_TICKER": set.status = 404; break;
            case "SEC_UPSTREAM": set.status = 502; break;
            default: set.status = 500;
          }
          return { error: error.message };
        }
        console.error("Failed to load company filings:", error);
        set.status = 500;
        return { error: "Could not load company filings. Please try again." };
      }
    });
}
