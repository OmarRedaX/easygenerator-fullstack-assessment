# ADR 0003 — Same-site topology and fail-closed Origin check

Status: accepted (2026-10-15)

## Context
Cookie sessions need CSRF defence. The first AI-proposed rule allowed requests that carried no `Origin` header, and
the hosting topology was left implicit (see `docs/AI-LOG.md`).

## Decision
- Supported topology is same-site only: `localhost:5173` ↔ `localhost:3000` locally; in production one reverse
  proxy (`/` frontend, `/api` backend) or sibling subdomains of one registrable domain.
- A global guard covers every unsafe method (POST, PUT, PATCH, DELETE), including unauthenticated signup and signin
  (login CSRF). `Origin` present → must exactly equal `CORS_ORIGIN` (the literal `null` is rejected); `Origin`
  absent → the `Referer` origin must match; both absent → 403. `Sec-Fetch-Site: cross-site` is rejected.
- CORS allows exactly one configured origin with credentials and no wildcard.

## Consequences
- Non-browser clients (curl, tests) must send an `Origin` header; the README says so.
- No CSRF token is needed under the supported topology.
- Cross-site hosting is unsupported. It would need `SameSite=None; Secure` plus a CSRF token (synchronizer or
  double-submit). This is recorded as future work.
