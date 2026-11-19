const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

export class SecError extends Error {
  constructor(
    public readonly code:
      | "INVALID_TICKER"
      | "INVALID_CIK"
      | "UNKNOWN_TICKER"
      | "SEC_CONFIG"
      | "SEC_UPSTREAM",
    message: string,
  ) {
    super(message);
    this.name = "SecError";
  }
}

export async function fetchSecJson(
  url: string,
  userAgent: string | undefined,
  fetcher = fetch,
): Promise<unknown> {
  if (!userAgent?.trim()) {
    throw new SecError(
      "SEC_CONFIG",
      "Set SEC_USER_AGENT to your application name and contact email.",
    );
  }
  try {
    const response = await fetcher(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new SecError(
        "SEC_UPSTREAM",
        `SEC request failed (HTTP ${response.status}).`,
      );
    }
    return await response.json();
  } catch (error) {
    if (error instanceof SecError) throw error;
    throw new SecError(
      "SEC_UPSTREAM",
      "Could not load SEC data. Please try again.",
    );
  }
}

function parseTickers(data: unknown): Map<string, string> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SecError("SEC_UPSTREAM", "SEC returned an invalid ticker map.");
  }

  const tickers = new Map<string, string>();
  for (const entry of Object.values(data)) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.ticker !== "string" ||
      !entry.ticker.trim() ||
      !Number.isSafeInteger(entry.cik_str) ||
      entry.cik_str <= 0 ||
      entry.cik_str > 9_999_999_999
    ) {
      throw new SecError(
        "SEC_UPSTREAM",
        "SEC returned an invalid ticker entry.",
      );
    }
    tickers.set(
      entry.ticker.trim().toUpperCase(),
      String(entry.cik_str).padStart(10, "0"),
    );
  }

  if (tickers.size === 0) {
    throw new SecError("SEC_UPSTREAM", "SEC returned an empty ticker map.");
  }
  return tickers;
}

// Each resolver owns its cache; injecting fetch keeps tests independent of SEC.
export function createTickerResolver(
  userAgent: string | undefined,
  fetcher = fetch,
) {
  let tickerMap: Promise<Map<string, string>> | undefined;

  async function loadTickers(): Promise<Map<string, string>> {
    return parseTickers(await fetchSecJson(TICKERS_URL, userAgent, fetcher));
  }

  return async function resolveCik(ticker: string): Promise<string> {
    const normalized = ticker.trim().toUpperCase();
    const allowedCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-";
    const hasInvalidCharacter = Array.from(normalized).some(
      (character) => !allowedCharacters.includes(character),
    );
    if (!normalized || normalized.length > 32 || hasInvalidCharacter) {
      throw new SecError("INVALID_TICKER", "Enter a valid company ticker.");
    }

    // Cache the pending request too, so simultaneous lookups share one download.
    tickerMap ??= loadTickers().catch((error) => {
      tickerMap = undefined;
      throw error;
    });
    const cik = (await tickerMap).get(normalized);
    if (!cik)
      throw new SecError(
        "UNKNOWN_TICKER",
        `No SEC company found for ticker ${normalized}.`,
      );
    return cik;
  };
}

export const resolveCik = createTickerResolver(process.env.SEC_USER_AGENT);
