import { Elysia } from "elysia";
import { fetchCompanyFilings } from "./filings";
import { resolveCik, SecError } from "./sec";

// Accept a loader so route tests can run without contacting SEC.
export function createApp(
  loadFilings = async (ticker: string) => fetchCompanyFilings(await resolveCik(ticker)),
) {
  return new Elysia()
    .get("/health", () => ({ status: "ok" }))
    .get("/companies/:ticker/filings", async ({ params, set }) => {
      try {
        return await loadFilings(params.ticker);
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
