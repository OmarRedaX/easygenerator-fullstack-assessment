---
title: Easygenerator Full Stack Assessment — Auth Module Design
status: draft-for-review
date: 2026-10-15
scope: monorepo (backend first, frontend second)
---

# Easygenerator Full Stack Assessment — Auth Module Design

## 1. Intent and success criteria

**Goal.** Deliver the assessment's sign-up / sign-in module as one public GitHub monorepo: a NestJS + MongoDB
backend, then a React + TypeScript frontend. Reviewers score functionality, production-readiness, code
quality, delivery speed (a few hours) and bonus items (logging, error handling, tests, CI, API docs).
`AI.md` is mandatory and is evaluated for judgement, not just disclosure.

**Success criteria.**
- Sign up, sign in, protected endpoint and logout work end to end with the field rules from the task.
- Security decisions in section 6 are implemented and covered by tests.
- CI is green: install, lint, strict typecheck, OpenAPI lint, unit tests, integration tests (real MongoDB), build.
- README lets a stranger run and test the repo; `AI.md` records real prompts, corrections and overrides.
- The task PDF is not in the repository.

**Development order.** Backend first: architecture, implementation, security and tests complete before any
frontend work starts. The frontend is a separate issue, branch and PR.

## 2. Repository layout (monorepo)

Single Git repository at `E:\Full Stack Projects\Easy Generator test task`. Git is initialised **only** at this
root. The folders on disk are currently `Backend/` and `Frontend/`; they are renamed to lowercase `backend/`
and `frontend/` as the first step of implementation (case-only rename; on Windows use a two-step `git mv`).

```
/ (repo root)
  package.json          # private, npm workspaces; delegates scripts
  package-lock.json     # single lockfile
  README.md             # repo-level run/test/CI/deployment-status docs
  AI.md                 # mandatory; assembled from docs/AI-LOG.md
  CLAUDE.md             # repo-wide rules: workflow, git, security pointers
  .gitignore            # node_modules, dist, coverage, .env*, *.pdf, settings.local.json
  .github/workflows/ci.yml
  .claude/{commands,skills}/
  contracts/openapi.yaml        # API source of truth (hand-written, contract-first)
  docs/{system-design.md, adr/, superpowers/specs/, AI-LOG.md}
  backend/              # NestJS + MongoDB (this phase)
  frontend/             # React + TypeScript (later phase)
```

- `workspaces` lists `backend` now and `frontend` is added when it is scaffolded (an empty workspace
  directory breaks `npm ci`).
- Root scripts delegate: `npm run lint|typecheck|test:unit|test:int|build -w backend`.
- `backend/CLAUDE.md` holds backend-specific binding rules (stack, layering, security rules by name).
  Root `CLAUDE.md` holds shared rules. Sections are cited by name, not number.
- Docs are placed by scope: repo-wide in root `docs/`, backend internals in `backend/` code and its CLAUDE.md.

## 3. Backend stack

NestJS 11, TypeScript `strict` (+ `noUncheckedIndexedAccess`), Mongoose, `express-session` + `connect-mongo`,
`argon2` (argon2id), `class-validator`/`class-transformer`, `@nestjs/config` with Zod env validation,
`nestjs-pino`, `@nestjs/swagger` (serves the contract, see section 9), `helmet`, `@nestjs/throttler`.
Tests: Jest + supertest against a **real MongoDB** (no in-memory server). Node 22 LTS.

```
backend/src/
  main.ts  app.module.ts
  config/            # zod-validated env
  common/            # error filter (single envelope), request-id, csrf guard, pipes
  modules/
    auth/            # controller, service, DTOs, SessionGuard, password policy constant
    users/           # schema, repository, service
    health/          # GET /health
```

Layering: controllers handle HTTP only; services hold rules; repositories are the only code touching
Mongoose models; modules call each other through services, never another module's repository.
Infrastructure exception: `HealthService` may use the Mongoose `Connection` solely to ping the database (no
models, no data access); the controller stays HTTP-only and maps its result to 200/503.

## 4. Endpoints (all under `/api`)

| Method and path | Access | Result |
|---|---|---|
| `POST /auth/signup` | public | validate, create user, start session → `201 { user }` |
| `POST /auth/signin` | public | verify credentials, regenerate session → `200 { user }` |
| `POST /auth/logout` | session | destroy session, clear cookie → `204` |
| `GET /auth/me` | session | **protected endpoint** → `200 { user }` |
| `GET /health` | public | liveness + Mongo ping; `503` if ping fails |

## 5. Validation

Global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`. One shared constant defines the password
policy; signup and tests use it, and the frontend mirrors it.

- **Email:** valid format, trimmed, lowercased, max 254.
- **Name:** trimmed, 3–80 characters.
- **Password:** 8–128 characters; at least one letter `[A-Za-z]`, one digit `[0-9]`, one special character.
  *Special* is the explicit ASCII set ``!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~``. A space is **not** special. Spaces and
  Unicode are allowed in passwords but satisfy no class.
- **Signin:** email and password checked for presence and type only; the policy is not re-applied.

## 6. Security (binding)

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

**Hardening.** `helmet`; global rate limit (100/min/IP) and stricter on signin/signup (10/min/IP); request-ID
middleware; pino redacts `password`, `cookie`, `set-cookie`; stack traces never reach clients; every `/api/auth`
response is `Cache-Control: no-store` (added after a browser pass, ADR 0008).

## 7. Data model and errors

**`users`:** `_id`, `email` (unique, lowercase), `name`, `passwordHash` (`select: false`), timestamps. JSON
serializer exposes only `id`, `email`, `name`, `createdAt`.

**`sessions`:** managed by `connect-mongo`; TTL index; stores only `userId` and `absoluteExpiresAt`; `touchAfter`
set to avoid a write per request.

**Error envelope** (single filter): `{ statusCode, error, message, details?, requestId }`.

| Status | Cause |
|---|---|
| 400 | validation failure, per-field `details` |
| 401 | invalid credentials, missing/invalid/expired session |
| 403 | failed CSRF/Origin check |
| 409 | duplicate email |
| 429 | rate limit |
| 500 | unexpected; generic body, logged with `requestId` |

Mongo outage at boot fails fast. Graceful shutdown closes the Mongo connection.

## 8. Testing

Real MongoDB: the `docker-compose` service locally, a service container in CI. The harness parses and validates
the server URI (it must not name a database; non-local hosts are refused unless `ALLOW_REMOTE_TEST_DB=true`),
generates a unique `auth_test_<12 hex>` database per suite, injects that URI over any environment override so
users (Mongoose) and sessions (connect-mongo) share it, and verifies the name before any destructive cleanup.
Cleanup runs even when initialisation fails. Coverage threshold 80% enforced in Jest.

**Unit:** password policy (boundaries 7/8/128, space is not special, missing classes); hasher; env validation
(secret decodes to ≥ 32 bytes, argon2 floor, placeholder rejection); error filter; CSRF guard matrix (Origin
match/mismatch/`null`, Referer fallback, both absent, `Sec-Fetch-Site`); `SessionGuard` incl. expiry;
`AuthService` with a mocked repository.

**Integration (supertest):** signup success, duplicate, concurrent-duplicate E11000 race, validation matrix;
signin success and identical generic 401 for both failure modes; cookie flags; session ID changes on
signin/signup; logout invalidates the server-side session (replayed cookie → 401); `/auth/me` with expired
`absoluteExpiresAt` → 401 and cookie cleared; CSRF fail-closed on signup, signin and logout; 429 on rate limit;
error envelope shape; `passwordHash` never in a response; health.

**Contract-drift test:** every operation in `contracts/openapi.yaml` is a registered route and vice versa.

## 9. API documentation

`contracts/openapi.yaml` (OpenAPI 3.1) is hand-written and is the source of truth. Swagger UI at `/api/docs`
serves that file directly, so there are no duplicate decorators to drift. Linted in CI with Redocly.

## 10. CI (shared, `.github/workflows/ci.yml`)

Triggers: pull requests and pushes to `main`. Permissions `contents: read`; actions pinned to versions;
concurrency cancels superseded runs; Node 22 LTS; single root lockfile (`npm ci`).

- **backend job:** install → lint → `tsc --noEmit` (strict) → OpenAPI lint → unit tests → integration tests
  against a `mongo:7` service container with a health check → `nest build` → `npm audit --audit-level=high
  --omit=dev`.
- **frontend job:** install → lint → typecheck → tests if present → production build. Runs only when
  `frontend/package.json` exists, so CI stays green during the backend-first phase.
- **docker job:** `docker build` check (no push) for each service that has a Dockerfile; `backend/Dockerfile`
  is multi-stage and non-root.
- **Deployment: not configured.** No deploy job exists. CI builds and verifies only, and the README states
  this. Deployment automation is added only if a real target and credentials are configured.

## 11. AI workflow (lean port of VCare)

- `CLAUDE.md` (root) and `backend/CLAUDE.md`: mission, locked stack, forbidden practices (no secrets in code, no
  password logging, no Mongoose outside repositories), layering, **Security rules** (section 6), git rules, and
  the duty to append to `docs/AI-LOG.md`.
- `.claude/commands/`: `/brainstorm`, `/construct-spec`, `/develop` (tests first), `/review-code` (parallel
  correctness, security and contract-drift reviewers, then adversarial verification of each finding),
  `/update-docs`.
- `.claude/skills/` (3): `auth-session-security`, `nest-module-conventions`, `mongo-integration-testing`.
- `docs/adr/`: NestJS + Mongoose; cookie sessions in Mongo; same-site topology + Origin check; argon2id
  parameters; duplicate-email disclosure; monorepo with npm workspaces.
- `docs/AI-LOG.md`: running log. `AI.md` (root) is assembled from it at the end.

**Seeded log entries (design phase).**
- Overrode AI recommendation: AI recommended access JWT + rotating refresh; user chose cookie sessions.
- AI proposed "current recommended" argon2 settings; user required explicit OWASP-minimum parameters.
- AI's CSRF rule allowed requests with no Origin; user required fail-closed with Referer fallback.
- AI left hosting topology implicit; user required defining it (same-site only).
- AI used "32 characters" for the secret and "any non-alphanumeric" for special; user required ≥ 32 bytes and an
  explicit set (space excluded).
- User required explicit `absoluteExpiresAt` enforcement instead of relying on cookie/TTL expiry.
- Delivery changed from two repos to a monorepo mid-design; spec updated, security decisions unchanged.

## 12. Git workflow

Monorepo, Git initialised at the root only. For each phase: GitHub issue → feature branch (`feat/...`) →
conventional commits → push → PR to `main`. Never commit directly to `main`; never auto-merge a PR. A PR is
opened only after implementation and local checks are complete and its description includes test evidence.
Backend and frontend are separate issues/branches/PRs. Creating the public GitHub repository, issues and PRs
is outward-facing and is confirmed with the user at the time.

## 13. Delivery phases

1. **Foundation (backend):** repo init, rename folders, root workspace, CLAUDE.md/.claude/docs skeleton, CI.
2. **Backend auth module:** config, users, auth, CSRF, session guard, error filter, health, OpenAPI, tests.
3. **Backend hardening and docs:** rate limits, Docker, README, ADRs.
4. **Frontend** (only after backend is complete and green): React + TS signup/signin/app pages, own PR.
5. **Submission:** `AI.md`, final README, CI results, repository link to the recruiter.

## 14. Open items

- GitHub repository name (suggested: `easygenerator-fullstack-assessment`) and visibility confirmation at creation.
- Exact Redocly/ESLint rule sets are chosen in the implementation plan.
