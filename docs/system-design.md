# System design

One page. Detail lives in the [design spec](superpowers/specs/2026-10-15-auth-assessment-design.md), the
[ADRs](adr/) and the API contract [`contracts/openapi.yaml`](../contracts/openapi.yaml).

## 1. High-level architecture

```
Browser -> Nest (global guards: Throttler, Csrf) -> Controller -> Service -> Repository -> MongoDB
```

Modules (`backend/src`):
- `config` — Zod-validated environment; the app refuses to start on invalid values.
- `common` — clock, request ID, single error envelope filter, CSRF guard, logging redaction.
- `modules/users` — schema, repository (only code using Mongoose models), service.
- `modules/auth` — controller, service, DTOs, password policy and hasher, session store and `SessionGuard`.
- `modules/health` — liveness plus a MongoDB ping.

Cross-cutting pipeline (`configureApp`), in execution order: request ID → helmet → CORS (one origin) → session →
16 kb JSON parser (the only body parser; form bodies are not parsed) → global guards (Throttler, CSRF) → validation
pipe → controller; the exception filter wraps everything and the `/api` prefix is applied to routes. A malformed or
oversized body therefore gets 400/413 before the CSRF check or rate limit runs. Swagger UI serves the contract at
`/api/docs`.

## 2. Authentication flow

Signup / signin:
1. Validate the body (whitelist, forbid unknown fields; signup applies the password policy).
2. Signup hashes the password with argon2id; signin verifies it (a dummy hash is verified for unknown emails).
3. Regenerate the session ID.
4. Store `userId` and `absoluteExpiresAt` (now + 7 days) in the session.
5. Respond with `{ user }` and the `httpOnly`, `SameSite=Lax` cookie.

Protected request (`GET /auth/me`, `POST /auth/logout`): `SessionGuard` requires `userId` and checks
`absoluteExpiresAt` on every call; an expired session is destroyed, the cookie cleared, and the response is 401.
`/auth/me` also destroys the session if the user no longer exists.

## 3. MongoDB collections

- `users`: `_id`, `email` (unique index, lowercased), `name`, `passwordHash` (`select: false`, never returned),
  timestamps. Responses expose only `id`, `email`, `name`, `createdAt`.
- `sessions` (connect-mongo): TTL index for housekeeping; each document holds only `userId` and
  `absoluteExpiresAt` (plus the cookie metadata express-session adds).

## 4. Frontend

```
Browser -> /api (same origin) -> Vite proxy (dev) | nginx (production) -> Nest API
```

`frontend/` is a React + TypeScript SPA (ADR 0007, spec in `specs/001-frontend-auth/`):
- `lib/api` — fetch client with base path `/api`, typed auth calls, `ApiError` / `NetworkError` (no React).
- `lib/validation` — password policy and Zod schemas mirroring the contract; a test reads `contracts/openapi.yaml`.
- `features/auth` — sign-up and sign-in pages, the session query, route guards, logout and error-to-message mapping.
- `features/home` — the welcome page. `components/ui` — hand-built presentational components styled with tokens.

Session: there are no tokens on the client. One TanStack Query entry (`['me']`) holds the user, or `null` when
signed out; a 401 from `GET /auth/me` is a normal answer and is not retried. Sign-in and sign-up cancel any pending
check before storing the user, so a late 401 cannot overwrite the new session. Logout clears the entry after success
or 401; other failures keep the user signed in, show the error and recheck. A 401 from any protected request, and a
page restored from the browser's back/forward cache, send the guards back to the server for the truth.

Routes: `/` (guarded), `/signin` and `/signup` (guest only), everything else redirects to `/`. Guards use `replace`
navigation and remember a safe return path (single leading `/`, never `//`, never the auth pages).

## 5. Key trade-offs

- Cookie sessions over JWT: immediate revocation at the cost of one lookup per protected request (ADR 0002).
- Same-site-only hosting keeps CSRF defence to a fail-closed Origin/Referer check, no token (ADR 0003).
- Signup discloses duplicate emails; limited by the strict auth rate limit (ADR 0005).
- argon2id at the OWASP floor, tunable, with a benchmark script; timing is narrowed, not equalised (ADR 0004).
- Tests run against a real MongoDB in an isolated `auth_test_*` database, not an in-memory server.
