# backend/CLAUDE.md — auth backend rules (binding)

Stack (locked): Node 22, TS strict, NestJS 11, Mongoose, express-session + connect-mongo, argon2, class-validator,
Zod (env only), nestjs-pino, helmet, @nestjs/throttler, Jest + supertest on a real MongoDB.
Forbidden: JWT/Passport for sessions, in-memory Mongo, Mongoose models outside repositories, logging secrets,
adding runtime dependencies without an ADR.

## Layering
controller (HTTP only) → service (rules) → repository (only code that uses Mongoose models). Modules call each other via services.
Infrastructure exception: `HealthService` may use the Mongoose `Connection` for a ping only (no models, no data access).
Anything else that touches Mongoose belongs in a repository.

## Testing
Test first. Unit specs beside sources; integration specs in `test/*.int-spec.ts` against real MongoDB.

## Security rules

**Passwords.** argon2id, memory 19456 KiB (19 MiB), 2 iterations, parallelism 1 (OWASP minimum). Values are
env-tunable; env validation rejects anything below this floor. README ships a benchmark script to run on the
deployment target. Passwords are never logged or returned.

**Signin errors.** One generic `401 Invalid email or password` for unknown email and wrong password. When the
user does not exist a dummy hash is verified to narrow the timing gap. This reduces, but does not guarantee
equal, response times.

**Duplicate email.** Unique index on `email` is the real guard. Mongo `E11000` is translated in the repository
to `DuplicateEmailError`, mapped to `409 Email already registered`. Signup reveals that an email is taken
(accepted trade-off; recorded in an ADR).

**Sessions.** Cookie-based server-side sessions stored in MongoDB (`connect-mongo`).
- Cookie: `httpOnly`, `SameSite=Lax`, `Secure` in production, explicit name, 7-day `maxAge`.
- Session data is exactly `userId` and `absoluteExpiresAt`, nothing else application-specific.
- `absoluteExpiresAt` (now + 7 days) is set when the authenticated session is created and **verified by
  `SessionGuard` on every protected request**. If expired: destroy the session, clear the cookie, return 401.
  `cookie.maxAge`, `touchAfter` and the Mongo TTL index are housekeeping only, never the enforcement.
- Session ID is regenerated on signin and signup (fixation defence). Logout destroys the server-side session.
- `/auth/me` for a session whose user no longer exists destroys the session and returns 401.
- `trust proxy` is configurable so secure cookies work behind a proxy.

**Secrets.** `SESSION_SECRET` must decode to ≥ 32 bytes; known placeholder values are rejected; the app
refuses to start otherwise. Entropy cannot be verified in code, so the README mandates generation with
`openssl rand -base64 32`.

**Hosting topology: same-site only (accepted).**
- Local: `localhost:5173` ↔ `localhost:3000` (ports do not change the site).
- Production: one reverse proxy (`/` frontend, `/api` backend, same-origin) or sibling subdomains of one
  registrable domain.
- Cross-site hosting is unsupported. It would require `SameSite=None; Secure` plus a CSRF token
  (synchronizer or double-submit); this is recorded as future work in an ADR.

**CSRF — fail closed.** A global guard covers every unsafe method (POST, PUT, PATCH, DELETE), including
unauthenticated signup and signin (login CSRF).
1. `Origin` present → must exactly equal an allowed origin (`CORS_ORIGIN`); the literal `null` is rejected.
2. `Origin` absent → `Referer` origin must match.
3. Both absent → `403`. No silent allow.
4. `Sec-Fetch-Site: cross-site` → rejected.
CORS and JSON-only bodies are not treated as a substitute. Non-browser clients (curl, tests) must send `Origin`;
the README says so. No CSRF token under the supported topology.

**CORS.** Exactly one configured origin with `credentials: true`; no wildcard.

**Caching.** Every response under `/api/auth` (success and error) carries `Cache-Control: no-store`, set by
`noStoreMiddleware` mounted on that path in `configureApp` before the body parser and guards (ADR 0008). A new
endpoint that returns user-specific data outside `/api/auth` must set its own `Cache-Control`. The contract declares
the header and a test checks behaviour and contract.

**Hardening.** `helmet`; global rate limit (100/min/IP) and stricter on signin/signup (10/min/IP); request-ID
middleware; pino redacts `password`, `cookie`, `set-cookie`; stack traces never reach clients.

