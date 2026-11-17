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

Tests use fixture responses, not live SEC requests. Filing retrieval, summary calculations, and their UI are not implemented yet.
