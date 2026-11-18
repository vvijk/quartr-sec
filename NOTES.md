# Notes

## Decisions

- User selected Bun, Elysia, React, Vite, and plain CSS; no database.
- One root package manifest, two development processes, no workspace tooling.
- Browser and backend TypeScript configurations are separate to keep Bun globals out of client code.
- Full history versus recent-only data remains a scope decision to review before completing the assignment.
- This incremental fetching step reads only filings.recent and explicitly returns historyScope: "recent". Additional history files are not downloaded; complete-history support remains undecided.

## Current status

- Placeholder React page and Elysia health endpoint; ticker-to-CIK resolver implemented in server/sec.ts.
- Local runtimes: Bun 1.4.4 and Node 22.13.1.
- User completed installation locally; bun.lock is present. All 14 tests, TypeScript checking, and Vite production build pass.
- Dependency declarations still use latest; installed versions are locked in bun.lock.
- Ticker map is cached for the process lifetime. Restart to refresh; no TTL or persistent storage for this assignment step.
- Concurrent ticker lookups share one request; failed downloads can be retried. No automatic retry loop.
- SEC_USER_AGENT must contain the user's application name and contact email. Live SEC access has not been verified in this step.
- Ticker lookup has no standalone HTTP endpoint; GET /companies/:ticker/filings now reuses it with fetchCompanyFilings.
- Recent submission fetching, normalization, the filing route, and a minimal React filing browser are implemented. The route now supports filtering, sorting, and pagination. Summary endpoint and calculations are implemented; React summary view is implemented below the filing browser.
- Required columns must contain strings and have matching lengths. Invalid records fail the whole transformation rather than silently reducing totals.
- Validation now uses plain character checks instead of regex. Accession numbers require digits after removing hyphens, without enforcing exact group lengths. Tickers use a basic allowed-character check; unmatched values are rejected by lookup. A small date helper keeps calendar validation out of the mapping logic. No non-null assertions are needed in the transformation.
- Missing primary document filenames link to the complete submission text. Dates remain YYYY-MM-DD strings; form names and SEC ordering are preserved.
- Submission responses are not cached yet. SEC HTTP headers, timeout, and error handling are shared with ticker fetching.
- Attempted live end-to-end AAPL check failed while loading SEC data (SEC_UPSTREAM). Live behavior remains unverified.
- Frontend includes ticker input, Search, filing table, SEC links, loading/error/empty states, and recent-history labeling. Search is disabled while loading to prevent overlapping requests.
- Latest verification: 26 tests pass; type checking and production build pass. Browser access to localhost was declined, so no visual/end-to-end browser verification was completed.

- Pagination defaults: page 1, limit 20, sort DESC. Form matching is exact after trimming and uppercasing. Filter and sort run before pagination; totals describe matching recent data. The frontend count now distinguishes displayed rows from total matches. Form, date sort, page size, and Previous/Next controls are implemented. Search applies edits from page one; navigation uses the last applied query.

- Summary: 1–10 unique tickers, rolling calendar-year UTC window with inclusive dates, exact form counts, latest exact 10-K across loaded recent history. Sequential company loading; HTTP 200 with per-company errors for valid batches. No archive lookup or global request rate limiter added.

- Summary UI: comma-separated input, reporting period, per-company form counts/latest 10-K, loading/request errors, partial failures, empty counts, and missing 10-K labels. All 26 existing tests and the production build/type check pass. Browser behavior remains unverified; previous localhost permission denial respected.

- Frontend visual refresh: grouped search surfaces, clearer headings and table styles, teal accents, local system fonts, and mobile layouts. Request/state behavior unchanged; no dependencies added. Build/type checks and 26 existing tests pass; browser layout verification remains pending.
