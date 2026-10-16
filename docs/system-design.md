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
- `modules/auth` — controller, service, DTOs, password policy and hasher, session store, `SessionGuard` and the
  no-store middleware.
- `modules/health` — liveness plus a MongoDB ping.

Cross-cutting pipeline (`configureApp`), in execution order: request ID → helmet → `Cache-Control: no-store` on `/api/auth` → CORS (one origin) → session →
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

## 4. Key trade-offs

- Cookie sessions over JWT: immediate revocation at the cost of one lookup per protected request (ADR 0002).
- Same-site-only hosting keeps CSRF defence to a fail-closed Origin/Referer check, no token (ADR 0003).
- Signup discloses duplicate emails; limited by the strict auth rate limit (ADR 0005).
- Authentication responses are `no-store`, set for `/api/auth` only so `/health` and Swagger keep their ETags
  (ADR 0008).
- argon2id at the OWASP floor, tunable, with a benchmark script; timing is narrowed, not equalised (ADR 0004).
- Tests run against a real MongoDB in an isolated `auth_test_*` database, not an in-memory server.
