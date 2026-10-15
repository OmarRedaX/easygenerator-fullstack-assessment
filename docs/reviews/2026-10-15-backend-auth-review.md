# Review: `feat/backend-auth` (2026-10-15)

Process (`/review-code`): three read-only reviewers ran in parallel (correctness, security vs the Security rules in
`backend/CLAUDE.md`, contract drift vs `contracts/openapi.yaml`). Every finding was then checked: reproduced by
running it, or refuted from the code. Survivors were fixed test-first. Nothing here was accepted on the reviewers'
word alone.

## Fixed (survived verification)

| # | Finding | How it was verified | Fix |
|---|---|---|---|
| 1 | Nest's default urlencoded parser stayed active (`useBodyParser('json')` only replaced the JSON one): a 90 KB form body bypassed the 16 kb limit and reached signin | Reproduced: `POST /auth/signin` with a 90 KB `application/x-www-form-urlencoded` body returned **401**, not 413/400 | `NEST_APP_OPTIONS = { bodyParser: false }` shared by `main.ts` and the test helper; new test `does not parse form-encoded bodies` (red, then green) |
| 2 | `SESSION_COOKIE_NAME` accepted any non-empty string; a name with a space/`;`/`=` booted fine and failed with 500 on the first signin | Read: schema was `z.string().min(1)`; 5 new unit cases failed before the change | RFC 6265 token regex in `env.schema.ts` |
| 3 | Session-destroy assertions could not fail: after the 401 clears the cookie the supertest agent drops it, so the "session was destroyed" check passed even if `destroySession` never ran; the deleted-user test never checked the session document | **Mutation test**: with `destroySession` disabled in the guard and in `/auth/me`, 2 tests now fail (before: the guard case passed) | Replay the old cookie explicitly and assert the `sessions` document is gone |
| 4 | Session-shape assertion filtered the expected keys by `k in data`, so a document missing `userId`/`absoluteExpiresAt` passed | Read | Exact key set `['absoluteExpiresAt','cookie','userId']` |
| 5 | `ConfigModule` loads `backend/.env` during tests; keys not pinned in `.env.test` (cookie name, proxy hops, argon2) could change assertions on a developer machine (a local `.env` exists here) | Not reproduced (I was not allowed to read the local `.env`); the mechanism is certain, process env wins over the file | Pin those keys in `backend/.env.test` |
| 6 | Dev compose published an unauthenticated Mongo on all interfaces (`0.0.0.0:27017`) | Read; `docker ps` showed the all-interface bind | Bind `127.0.0.1` with `MONGO_PORT` override |
| 7 | Contract drift: logout lacked 400/413; health lacked 429 (global throttler); no 500 anywhere; `Set-Cookie` clearing undocumented on logout 204 and on the 401s that clear it; `X-Request-Id` undocumented; 403 text omitted `Sec-Fetch-Site` and `Origin: null` | Read both sides; throttler is a global `APP_GUARD` with no skip on health; guard checks `Sec-Fetch-Site` before `Origin` | `contracts/openapi.yaml` updated (valid; one acceptable license warning) |
| 8 | Docs said `CORS_ORIGIN` has a default (it is required); system-design listed the pipeline as if CSRF/throttling ran before body parsing; ADR 0004 claimed the 128-char limit bounds all hashing (not true for signin) | Read `env.schema.ts`, `csrf.guard.ts`, `signin` DTO | README, `docs/system-design.md`, ADR 0004 corrected |

## Verified / refuted
- **Dev Mongo conflict found while verifying #6:** a native `mongod` 8.0.13 listens on `127.0.0.1:27017` on this
  machine, so local integration runs had been using it, not the compose `mongo:7` that CI uses. It was safe (the
  harness only creates/drops `auth_test_*`; no leftovers found), but I re-ran the whole suite against the `mongo:7`
  container on `MONGO_PORT=27018`: 18 suites, 222 tests pass, coverage 98.7 / 87.5 / 98.6 / 99.7 %.
- Security reviewer rule-by-rule result: no other findings (sessions, CSRF matrix, CORS, argon2, signin errors,
  NoSQL injection, redaction, layering, Dockerfile, CI permissions).

## Accepted, not fixed
- Signup creates the user before starting the session, so a session-store failure returns 500 although the account
  exists (a retry then gets 409; signin works). Rare infrastructure failure; no compensation logic added.
- `createTestApp` can leave connect-mongo's client open if `compile()` throws while Mongo is unreachable. Test-only
  failure path; the production entry point exits with `process.exit(1)`.
- JSON-Schema `minLength`/`maxLength` count code points while class-validator counts UTF-16 units, and the contract's
  `.` in the password pattern excludes newlines. Edge cases for astral characters / embedded newlines only.
- `contract.int-spec.ts` only checks the route set, not statuses or schemas. A stronger drift test is future work.
- Hardening nits: `NODE_ENV` defaults to `development` (Docker image sets `production`); Swagger UI is public;
  GitHub Actions pinned by tag, not SHA.
