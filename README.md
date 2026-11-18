# SEC Filings

Quartr coding assignment. TypeScript, Bun, Elysia, React, Vite, and plain CSS. No database.

## Setup

Use Bun 1.4.4 (the locally installed version). Vite runs using Node; the installed Node 22.13.1 meets Vite's documented requirement of 20.19+ or 22.12+.

```sh
bun install
```

Dependencies are installed and `bun.lock` records the resolved versions. Use `bun install --frozen-lockfile` for repeatable installs. Package declarations still use `latest`; exact declaration pinning remains a submission cleanup task.

Copy `.env.example` to `.env` and replace the placeholder with your application name and real contact email. Bun loads `.env` automatically. Restart the server after changing it.

```sh
cp .env.example .env
```

## Development

Start the API in one terminal:

```sh
bun run dev:server
```

Start React in another:

```sh
bun run dev
```

Open http://localhost:5173. The API listens on http://localhost:3000.

Vite forwards `/api/*` to the API and strips `/api`. For example, `/api/health` reaches `/health`. The required API routes will retain their assignment paths on port 3000.

## Verification

```sh
bun test
bun run typecheck
bun run build
curl http://localhost:3000/health
curl http://localhost:5173/api/health
```

Both health requests should return `{"status":"ok"}` with the development servers running.

`bun run preview` previews the static frontend build only; it does not provide the development API proxy. Production hosting is not configured.

## Structure

- `client/`: React entry point, placeholder page, plain CSS.
- `server/`: Elysia server with a setup health route.
- `vite.config.ts`: React plugin and development API proxy.
- `tsconfig.json`, `tsconfig.server.json`: separate browser/server type checking.

## Ticker lookup

`resolveCik` in `server/sec.ts` accepts a ticker and returns its 10-digit CIK string. For example, ` aapl ` resolves to `0000320193`. Lookup uses SEC's `https://www.sec.gov/files/company_tickers.json` and preserves ticker punctuation (it does not guess aliases between dots and hyphens).

The ticker map is fetched lazily and cached in memory until the server restarts. Concurrent lookups share the same request. Failed downloads are not cached. Requests have a 10-second timeout and use `SEC_USER_AGENT`.

`SecError.code` distinguishes invalid input, an unknown ticker, missing configuration, and SEC/network/response failures. The upcoming filing routes can map those codes to HTTP responses. No separate ticker route has been added.

To smoke-test against SEC after configuring `.env`:

```sh
bun -e 'import { resolveCik } from "./server/sec"; console.log(await resolveCik("AAPL"));'
```

Tests use fixture responses, not live SEC requests.

## Submission fetching and transformation

`fetchCompanyFilings(cik)` in `server/filings.ts` accepts the resolved 10-digit CIK, fetches the main submissions JSON, and returns company metadata plus standardized filings. `transformFilings(columns, cik)` is the pure transformation function. Shared response types live in `shared/types.ts`.

```ts
const cik = await resolveCik("AAPL");
const company = await fetchCompanyFilings(cik);
// { cik, name, historyScope: "recent", filings: [...] }
// Each filing: { accessionNumber, form, filingDate, documentUrl }
```

Only `filings.recent` is loaded. Historical files in `filings.files` are not fetched. Pagination totals describe the filtered, loaded records, not the company's complete history. An absent recent 10-K does not prove no historical 10-K exists.

The transformation validates the required parallel arrays and maps values at the same index into a filing. It preserves all forms and SEC ordering. Missing primary document filenames fall back to the complete submission `.txt` URL. Invalid columns or records raise SEC_UPSTREAM instead of producing partial results.

Submission requests reuse the ticker request headers, 10-second timeout, and error handling. Submissions are not cached in this step. Filtering, sorting, and pagination are implemented in the route; summary calculations remain unimplemented.

## Filing browser

Open http://localhost:5173 with both development servers running, enter a ticker such as AAPL, and click Search. The page shows company metadata and a table of forms, filing dates, accession numbers, and links to SEC documents. It includes initial, loading, error, and empty states. Only recent history is shown; the UI supports form filtering, date sorting, page size (10/20/50), and Previous/Next navigation. Click Search to apply edited criteria starting at page one. Navigation retains the last applied search, even if inputs have been edited. Any form type can be entered; the suggestions are not a restriction.

`GET /companies/:ticker/filings` returns the existing CompanyFilings response. The frontend calls it through Vite at `/api/companies/:ticker/filings`. Invalid tickers return 400, unknown tickers 404, SEC failures 502, and server/configuration errors 500, with a JSON `error` message.

Routes live in server/app.ts; server/index.ts starts the listener. The app factory accepts a filing loader so HTTP response tests do not need SEC access. Browser verification was blocked by declined localhost permission; 16 automated tests, type checking, and the production build passed.

Live check:

```sh
bun -e 'import { resolveCik } from "./server/sec"; import { fetchCompanyFilings } from "./server/filings"; const result = await fetchCompanyFilings(await resolveCik("AAPL")); console.log(result.name, result.filings.length, result.filings[0]);'
```

The agent's live check failed while loading SEC data; fixture tests, type checking, and production build passed.

## Filing query parameters

Example: `GET /companies/AAPL/filings?form=10-K&sort=DESC&page=2&limit=20`

- `form`: optional; trimmed and uppercased, then matched exactly (`10-K` does not include `10-K/A`). Blank means all forms.
- `sort`: `ASC` or `DESC` by filing date, default `DESC`. Accession number breaks date ties in the same direction.
- `page`: positive integer, default `1`.
- `limit`: positive integer, default `20`.

The route filters and sorts before slicing and does not mutate the source array. The response keeps company metadata and `filings`, adding `page`, `limit`, `total`, and `totalPages`. `total` counts matching recent filings before pagination. No matches means `totalPages: 0`; out-of-range pages return an empty array with unchanged totals. Invalid sort or pagination values return 400 before SEC fetching.
