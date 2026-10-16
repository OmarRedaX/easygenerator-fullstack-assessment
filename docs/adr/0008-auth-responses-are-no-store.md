# ADR 0008 — Authentication responses are `Cache-Control: no-store`

Status: accepted (2026-10-16)

## Context
The API sent no `Cache-Control` header, only the `ETag` that Express adds. A response with no freshness information
may still be reused by a browser in some situations. It was seen in Chrome: after sign-out, Back reloaded the page
from history and `GET /api/auth/me` was answered from the HTTP cache (a cached `200`, no request sent), so the
signed-in page appeared while the server said `401`. The frontend now defends itself (`cache: 'no-store'`), but any
other client, proxy or future frontend would still be exposed. Authentication responses say who is signed in.

Options considered:
- **A. Every `/api` response.** One rule, but it also removes `ETag`/`304` from `/health` and the Swagger page for no
  benefit.
- **B. Authentication endpoints only (chosen).** Narrow and matches the risk.
- **C. Client-side only.** Leaves the gap for every other client.

## Decision
- `Cache-Control: no-store` on every response under `/api/auth`: `signup`, `signin`, `logout` and `me`, success or
  error (`400`, `401`, `403`, `409`, `413`, `429`, `500`).
- It is one small middleware (`noStoreMiddleware`) mounted on the `/api/auth` path in `configureApp`, after
  `helmet` and before the body parser and the guards. Mounting by path, not on the controller, is what makes the
  answers produced before routing (malformed or oversized JSON) carry it as well.
- `/api/health` and the Swagger routes are not changed.
- The contract declares the header (`components/headers/NoStore`) on each auth success response and says in the API
  description that errors carry it too; an integration test checks both the behaviour and the contract.

## Consequences
- A new endpoint outside `/api/auth` that returns user-specific data must set its own `Cache-Control`; this ADR does
  not cover it. If more such endpoints appear, revisit option A.
- The middleware is coupled to the `/api/auth` path prefix, which is a constant in `app.setup.ts`; a test fails if
  a response under it loses the header.
- Reverse proxies such as the frontend's nginx need no extra configuration: they pass `Cache-Control` through.
