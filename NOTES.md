# Notes

## Decisions

- User selected Bun, Elysia, React, Vite, and plain CSS; no database.
- One root package manifest, two development processes, no workspace tooling.
- Browser and backend TypeScript configurations are separate to keep Bun globals out of client code.
- Full history versus recent-only data remains a proposal to review before implementing SEC integration.

## Current status

- Placeholder React page and Elysia health endpoint; ticker-to-CIK resolver implemented in server/sec.ts.
- Local runtimes: Bun 1.4.4 and Node 22.13.1.
- User completed installation locally; bun.lock is present. Six ticker tests, TypeScript checking, and Vite production build pass.
- Dependency declarations still use latest; installed versions are locked in bun.lock.
- Ticker map is cached for the process lifetime. Restart to refresh; no TTL or persistent storage for this assignment step.
- Concurrent ticker lookups share one request; failed downloads can be retried. No automatic retry loop.
- SEC_USER_AGENT must contain the user's application name and contact email. Live SEC access has not been verified in this step.
- Ticker lookup has no standalone HTTP endpoint; it will be used by the required filing routes.
- No filing retrieval, filing routes, or summary calculations yet.
