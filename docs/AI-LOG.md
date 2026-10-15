# AI Log

Running log of AI-assisted steps. Format: `## YYYY-MM-DD <topic>` with **Prompt / AI output / Correction / Decision**.
`AI.md` (root) is assembled from this file at the end.

## 2026-10-15 Session mechanism: JWT vs cookie sessions
- **Prompt:** Design the authentication mechanism for the signup/signin/me backend.
- **AI output:** Recommended an access JWT plus a rotating refresh token.
- **Correction:** User rejected the JWT recommendation and chose cookie sessions.
- **Decision:** Overrode the AI recommendation; cookie sessions are used.

## 2026-10-15 Argon2 hashing parameters
- **Prompt:** Choose password hashing settings for the backend.
- **AI output:** Proposed "current recommended" argon2 settings without stating exact values.
- **Correction:** User required explicit OWASP-minimum parameters instead of a vague "recommended" label.
- **Decision:** The spec states explicit OWASP-minimum argon2 parameters.

## 2026-10-15 CSRF rule and missing Origin header
- **Prompt:** Define the CSRF protection rule for unsafe requests.
- **AI output:** A CSRF rule that allowed requests carrying no Origin header.
- **Correction:** User required the rule to fail closed, with a Referer fallback.
- **Decision:** CSRF check fails closed: Origin, then Referer, otherwise reject.

## 2026-10-15 Hosting topology
- **Prompt:** Design the security model for the browser-to-API setup.
- **AI output:** Left the hosting topology implicit.
- **Correction:** User required the topology to be defined explicitly (same-site only).
- **Decision:** The spec defines a same-site-only topology.

## 2026-10-15 Secret length and special-character wording
- **Prompt:** Specify the session secret and password policy requirements.
- **AI output:** Used "32 characters" for the secret and "any non-alphanumeric" for the special-character rule.
- **Correction:** User required a secret of at least 32 bytes and an explicit set of special characters (space excluded).
- **Decision:** Spec uses a minimum of 32 bytes for the secret and an explicit special-character set that excludes space.

## 2026-10-15 Absolute session expiry enforcement
- **Prompt:** Specify how session lifetime is enforced.
- **AI output:** Relied on cookie/TTL expiry for session lifetime.
- **Correction:** User required explicit `absoluteExpiresAt` enforcement instead of relying on cookie/TTL expiry.
- **Decision:** Expiry is enforced explicitly via `absoluteExpiresAt`.

## 2026-10-15 Two repos to monorepo
- **Prompt:** Decide the delivery structure of the project.
- **AI output:** Initial design assumed two separate repositories.
- **Correction:** Delivery changed from two repos to a monorepo mid-design; the spec was updated.
- **Decision:** Monorepo adopted; security decisions unchanged.

## 2026-10-15 gh CLI missing
- **Prompt:** Execute the plan's Task 1, which uses `gh repo create` and `gh issue create`.
- **AI output:** Plan steps relying on the `gh` CLI, which is not installed on this Windows machine.
- **Correction:** Used the GitHub MCP tools (`create_repository`, `issue_write`) instead; they will also be used for the PR.
- **Decision:** Same outcome as planned; the user had confirmed a public repo named `easygenerator-fullstack-assessment`.

## 2026-10-15 Case-only folder rename blocked
- **Prompt:** Rename `Backend` to `backend` per the plan (`mv Backend backend_tmp && mv backend_tmp backend`).
- **AI output:** The planned two-step `mv` failed with "Device or resource busy"; `Rename-Item` failed likewise. A scan of process working directories found OpenAI Codex desktop helper processes (node.exe / node_repl.exe) with their cwd inside `Backend\`.
- **Correction:** Asked the user instead of killing processes; the user closed Codex themselves, after which the rename succeeded. The empty `frontend/` folder was recreated by remove + mkdir because it was empty.
- **Decision:** User chose to close Codex rather than have processes killed.

## 2026-10-15 .gitattributes added
- **Prompt:** (Not in the plan.) Git emitted CRLF warnings on Windows during Task 1.
- **AI output:** Added `.gitattributes` with `* text=auto eol=lf` so Dockerfile and shell scripts stay LF for Linux CI.
- **Correction:** None needed; this was an addition beyond the plan.
- **Decision:** Kept as a small addition.

## 2026-10-15 Task 1 run inline; Docker daemon
- **Prompt:** Execute Task 1 of the plan.
- **AI output:** The AI executed Task 1 itself rather than via a subagent, because the subagent workflow's ledger needs the git repo that Task 1 creates. The Docker daemon was not running at the start.
- **Correction:** The user started Docker Desktop before the Mongo-dependent tasks.
- **Decision:** Task 1 inline; Docker started by the user ahead of Mongo-dependent work.

## 2026-10-15 Nest 12 vs Nest 11
- **Prompt:** Install the NestJS packages as the plan specifies (`npm install @nestjs/*`, unpinned).
- **AI output:** The unpinned install resolved the ESM-only Nest 12 (then-latest), which broke Jest (CJS ts-jest, `ERR_REQUIRE_ESM`).
- **Correction:** The implementer pinned the Nest 11 line (`@nestjs/config` 4) and reinstalled cleanly.
- **Decision:** The stack is locked to Nest 11 in `backend/CLAUDE.md`.

## 2026-10-15 Root test scripts and test setup tweaks
- **Prompt:** Add the root `test:unit`, `test:int` and `test:cov` scripts from the plan.
- **AI output:** The plan's root scripts did not forward extra arguments; `npm run test:unit -- --passWithNoTests` failed.
- **Correction:** Added a trailing ` --` to the three root scripts. Also set dotenv `quiet: true` in `test/setup-env.ts` (dotenv 18 prints a banner) and added `*.tsbuildinfo` to `.gitignore`.
- **Decision:** Kept all three small changes.

## 2026-10-15 Build emitted no dist on second run
- **Prompt:** Review Task 3 (backend scaffold).
- **AI output:** The plan's tsconfig `incremental: true` combined with nest-cli `deleteOutDir: true` made a second `nest build` emit no `dist/` (bug found by the Task 3 reviewer).
- **Correction:** Set `"incremental": false` in `tsconfig.build.json`. The same fix commit pinned `@types/node` to ^22 (npm had resolved 26 for a Node 22 target) and restored a `jest.config.ts` regex backslash the implementer had dropped.
- **Decision:** Fixes applied in a follow-up commit.

## 2026-10-15 Env schema placeholder check and ConfigModule type
- **Prompt:** Implement the Task 4 environment schema from the plan.
- **AI output:** The plan's placeholder check only inspected the raw base64 string, so a base64-wrapped placeholder passed; its own test case `placeholder` would not have been rejected for that reason. `appConfigModule` was typed as returning `DynamicModule`.
- **Correction:** The check now scans both the raw and the base64-decoded forms. `ConfigModule.forRoot` in `@nestjs/config` 4.0.4 returns `Promise<DynamicModule>`, so the return type of `appConfigModule` was changed accordingly.
- **Decision:** Both corrections kept.

## 2026-10-15 argon2 0.45 typings and PHC parameter order
- **Prompt:** Implement the Task 5 password hasher exactly as written in the plan.
- **AI output:** The plan's code used `argon2.Options` and tested for hash parameters in the order `m,t,p`.
- **Correction:** argon2 0.45 exports the options type as `HashOptions` (`argon2.Options` failed to compile), and it emits the parameters as `m,p,t`, so the plan's regex failed. Renamed the type, and made the spec's regex order-independent while still requiring m=19456, t=2, p=1. While transcribing the spec, one backslash in the special-characters list was dropped; caught by lint and restored, so all 32 characters are tested.
- **Decision:** Minimal fixes; hasher interface and test intent unchanged.

## 2026-10-15 jest --selectProjects swallows file pattern
- **Prompt:** Run Task 5 specs with `npm run test:unit -w backend -- <pattern>`, using the plan's `jest --selectProjects unit` script.
- **AI output:** The plan's script form made `-- <pattern>` run all unit suites, because `--selectProjects` is variadic and consumed the pattern as a project name (found by the Task 5 reviewer).
- **Correction:** The reviewer-suggested `--selectProjects=unit` did not help (the `=` form is still variadic and swallowed the pattern); verified by running it. Fixed with a boolean flag after the project name, `jest --selectProjects unit --verbose=false`, which ends the variadic list. `test:int` already had `--runInBand` there.
- **Decision:** Fixed in a follow-up commit and verified that `-- password-hasher` runs only that suite.

## 2026-10-15 Mongo driver handshake fails under Jest (Task 6)
- **Prompt:** Implement Task 6 (users module and isolated test-database harness) and run `npm run test:int`.
- **AI output:** The plan's harness and repository code were correct, but the real-MongoDB test hung until timeout. The plan's `testTimeout: 30000` inside the `int` project was also not applied (failure said 5000 ms).
- **Correction:** Root cause found by bisecting: the mongodb 7.7 driver builds its handshake metadata through a dynamic `import('os')`, which fails under Jest's CommonJS VM without `--experimental-vm-modules`; the driver squashes the error, sends `{}` metadata, and the server rejects it ("Missing required sub-document 'driver'"). Verified with `NODE_OPTIONS=--experimental-vm-modules` before changing anything. Fix is confined to test tooling: `test:int` and `test:cov` run jest through `node --experimental-vm-modules --disable-warning=ExperimentalWarning ../node_modules/jest/bin/jest.js` (no `cross-env` dependency, per the no-new-dependencies rule), and `testTimeout` moved to the top level of `jest.config.ts` because Jest ignores it inside `projects` entries. No production code touched.
- **Decision:** Also deviated from the plan's `UsersModule` by exporting only `UsersService`, not `UsersRepository`, to honour "modules call each other via services" in `backend/CLAUDE.md`.

## 2026-10-15 CORS echoed to foreign origins and malformed JSON lost its message (Task 12)
- **Prompt:** Implement Tasks 9-12 test-first; Task 12 is the security integration suite, with "fix the code, not the test" for failures.
- **AI output:** The plan's `configureApp` passed `origin: CORS_ORIGIN` (a static string) to `enableCors`, and relied on `HttpExceptionFilter` alone to map body-parser errors. Tasks 9-11 passed unchanged; the new suite failed 2 of 22 tests.
- **Correction:** (1) With a static string the `cors` package sends `Access-Control-Allow-Origin: <configured origin>` to every caller, including `https://evil.example`. Browsers still block it, but it is not "no other origin is granted"; replaced with an exact-match origin callback so foreign origins get no CORS headers. (2) Malformed JSON returned the parser's wording ("Unexpected end of JSON input") instead of `Malformed JSON body`. Root cause, confirmed by logging what reached the filter: Nest's `RoutesResolver.mapExternalException` converts any `SyntaxError` into `new BadRequestException(err.message)`, which drops `type: 'entity.parse.failed'` before the filter runs (413 is not a `SyntaxError`, so it was unaffected). Fixed with `bodyParserErrorMiddleware`, registered right after the JSON body parser, that re-maps that one error type; the filter is unchanged.
- **Decision:** The plan's fallback (b) suggested an Express error middleware that delegates to the filter. Chose to re-map to a `BadRequestException` and let Nest route it to the filter instead, so there is still exactly one place that builds the error envelope. A temporary debug line in the filter was reverted before committing.

## 2026-10-15 Plan contract failed its own lint; compose file was invalid YAML (Tasks 13-14)
- **Prompt:** Implement Tasks 13 (OpenAPI contract) and 14 (Docker, compose, benchmark) exactly as the plan writes them, and run the plan's verification steps.
- **AI output:** The plan's `openapi.yaml` failed its own Step 2 lint with 3 errors: the public operations (signup, signin, health) had no `security` entry, which Redocly's `security-defined` rule requires to be explicit. The plan's compose line `SESSION_SECRET: ${SESSION_SECRET:?generate one with: openssl rand -base64 32}` is an unquoted YAML scalar containing `: `, so `docker compose` refused the whole file.
- **Correction:** Added `security: []` to the three public operations (the OpenAPI way to say "intentionally public") and tag descriptions; quoted the compose value. Port 3000 on this machine was held by an unrelated process, so the published port became `${API_PORT:-3000}` (same default) and the container was verified on 3100. `docker compose down` also removed the dev Mongo container, which was restarted before running tests.
- **Decision:** The plan's Swagger/CSP caveat was checked rather than assumed: the served page loads only same-origin scripts, so helmet's default CSP is kept strict and no relaxation was added.

## 2026-10-15 Review gate findings (Task 16, /review-code)
- **Prompt:** Run `/review-code`: correctness, security and contract-drift reviewers in parallel, then try to refute each finding.
- **AI output:** The reviewers reported about 20 candidate findings. Each was checked by reproducing it or reading the code; one was empirically confirmed as a real bug that all of Tasks 9-15 had missed: Nest's default urlencoded body parser stayed registered, so a 90 KB form body bypassed the 16 kb limit (signin returned 401 instead of 413/400). A mutation test also showed two session-destroy assertions I had copied from the plan could not fail, because the supertest agent drops a cookie the server clears.
- **Correction:** Fixed test-first: `bodyParser: false` via a shared `NEST_APP_OPTIONS`; cookie-name validation at startup; explicit cookie replay and session-document checks (mutation-verified); pinned test env keys; loopback-only dev Mongo; contract and docs drift (500, 429 on health, logout 400/413, Set-Cookie clearing, X-Request-Id, 403 wording; README claimed `CORS_ORIGIN` had a default; ADR 0004 overstated the hashing bound). Full list and the accepted-not-fixed items are in `docs/reviews/2026-10-15-backend-auth-review.md`.
- **Decision:** Findings about rare infrastructure failures (user created but session store fails; test helper leak when Mongo is down) were accepted and documented, not fixed. Two incidental discoveries: a native `mongod` 8.0.13 owns `127.0.0.1:27017` here, so earlier local integration runs used it rather than the compose `mongo:7` that CI uses; the full suite was re-run against `mongo:7` on another port (222 tests pass). A request to read the local `backend/.env` (key names only) was blocked by the permission classifier and was not worked around; the fix did not need it.
