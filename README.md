# SEC Filings

Quartr coding assignment built with TypeScript, Bun, Elysia, React, Vite, and plain CSS. No database.

Browse company filings with filtering, sorting, and pagination, or compare filing counts across companies over the last 12 months.

## Setup

Tested with Bun 1.4.4 and Node.js 22.13.1. Install both before starting.

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Set `SEC_USER_AGENT` in `.env` to your application name and real contact email:

```env
SEC_USER_AGENT="QuartrAssignment your-email@example.com"
```

The API loads `.env` automatically. Restart it after changing this value. Internet access to SEC is required.

## Run locally

Start the API:

```sh
bun run dev:server
```

In a second terminal, start the frontend:

```sh
bun run dev
```

Open http://localhost:5173. The API runs at http://localhost:3000; Vite forwards frontend `/api` requests to it.

Search for a ticker such as `AAPL`, or enter comma-separated tickers such as `AAPL,MSFT,JPM` in the summary section.


## API

- `GET /health` — health check.
- `GET /companies/AAPL/filings?form=10-K&sort=DESC&page=1&limit=20` — company filings. All query parameters are optional. Defaults: all forms, `DESC`, page `1`, limit `20`. Filtering and sorting happen before pagination.
- `GET /filings/summary?tickers=AAPL,MSFT,JPM` — accepts 1–10 unique tickers and returns counts per form over the last 12 months, plus the latest available exact `10-K` date. Individual company failures are returned in `errors` alongside successful results.

## Scope

Only SEC's `filings.recent` data is loaded; historical archive files are not fetched. Counts and pagination totals therefore cover the loaded records. The latest `10-K` is searched across those records, independently of the 12-month counting window. A missing date means it was not found in the loaded history.

The ticker mapping is cached in memory until the server restarts. Company submissions are fetched on each request.

## Project structure

- `client/` — React UI and CSS.
- `server/` — API routes, SEC integration, and tests.
- `shared/` — shared TypeScript response types.
- `PROMPT_LOG.md` — AI conversation log.
