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

## 2026-10-16 Frontend brainstorm and design spec
- **Prompt:** Download github/spec-kit, then `/superpowers:brainstorming` to start the frontend; Tailwind with hand-built components, led by the installed Apple Design Skill.
- **AI output:** Classified the work as architectural. Read the parent spec, `contracts/openapi.yaml` and the task PDF, then proposed one visual direction as an interactive browser mockup (sign up, sign in, welcome, validation/loading/error/mobile states) and a technical design: Vite + React 19 + TS strict, React Router, React Hook Form + Zod, TanStack Query, Tailwind v4, Vitest; `/api` same-origin proxy (option A) over direct CORS (option B).
- **Correction:** The user tightened four points before the spec was written: the proxies must preserve the `/api` prefix; `CORS_ORIGIN` must be the browser-visible origin because the CSRF guard checks it even behind a same-origin proxy; a 401 from `GET /api/auth/me` is a normal signed-out result (no retry) and `cancelQueries` must run before `setQueryData` on sign-in/sign-up so an older 401 cannot overwrite the new session; the request reference is shown only when one exists, and logout clears the cache only after success or 401. All four are in `docs/superpowers/specs/2026-10-16-frontend-design.md`.
- **Decision:** spec-kit drives the frontend (specify/plan/tasks/implement) instead of the brainstorming skill's `writing-plans` handoff, by explicit user choice; the existing commands stay for the backend. The spec-kit clone lives outside the repo at `E:\Full Stack Projects\spec-kit`. Branch `feat/frontend-auth` was cut from `feat/backend-auth` because the backend is not on `main` yet.

## 2026-10-16 Git state check and spec-kit scaffold
- **Prompt:** The user merged `feat/backend-auth` into `main`; verify the branch state, rebase only if necessary, preserve the design commit and untracked files, then continue the approved workflow without pushing.
- **AI output:** `git fetch` showed `main` at merge commit `83bf37c`, whose tree is identical to `10cbc93` (the commit `feat/frontend-auth` was cut from); the backend tip is an ancestor of `origin/main` and the PR diff against `main` is only the frontend spec files, so no rebase was needed. Ran `specify init` in an empty scratch directory (spec-kit 1.2.1.dev0, claude integration, powershell scripts) and copied only `.specify/` and `.claude/skills/speckit-*` into the repo, so nothing existing could be overwritten.
- **Correction:** The design spec still said the branch was cut from the unmerged backend branch; updated. The new `speckit-*` skills were not registered until the files existed on disk, so `/speckit-constitution` was followed from its SKILL.md.
- **Decision:** Skipped `--force` init at the repo root (it merges/overwrites). Constitution v1.0.0 is seeded from the root `CLAUDE.md` and the frontend design; the git rule that spec-kit must not create or switch branches is written into it. Nothing pushed; PR to `main` awaits the user's confirmation.

## 2026-10-16 /speckit-specify for the frontend auth feature
- **Prompt:** `/speckit-specify` with the frontend design doc (sections 1-8) and `contracts/openapi.yaml` as the source, working on `feat/frontend-auth`, feature in `specs/001-frontend-auth/`.
- **AI output:** `specs/001-frontend-auth/spec.md`: four prioritised user stories (sign-up, sign-in + welcome, session/guards/logout, polished accessible UI), edge cases, 22 functional requirements, 9 measurable outcomes, assumptions; plus `checklists/requirements.md` (all items pass, zero `[NEEDS CLARIFICATION]` markers because the brainstorm had already settled every open question).
- **Correction:** The design doc is deliberately technical, but the spec-kit template asks for technology-agnostic WHAT. Kept stack, proxy and file-layout details out of the spec and pointed to the design doc and constitution from Assumptions so `/speckit-plan` carries them. `.specify/feature.json` is git-ignored by spec-kit (per-checkout state).
- **Decision:** The skills' own branch-creation hook is not installed (no git extension), so no branch was created or switched, as required by the constitution.

## 2026-10-16 /speckit-plan: dependency audit changed three design decisions
- **Prompt:** `/speckit-plan` with the frontend design doc and constitution as context; choose Docker base images, nginx hardening headers and the ESLint rule set (design doc section 11).
- **AI output:** `specs/001-frontend-auth/{plan,research,data-model,quickstart}.md` and `contracts/{api-usage,routes,ui-tokens}.md`. Checked every planned package with `npm view` instead of trusting memory (today's registry has Vite 8, Vitest 5, React Router 8, TypeScript 7, ESLint 10).
- **Correction:** (1) `typescript-eslint@8.71` declares `typescript <6.1`, so the frontend is pinned to TS `^6.0.3` like the backend, not TS 7. (2) `eslint-plugin-jsx-a11y@6.10.2` peers `eslint <= 9` while the repo uses ESLint 10, so it is dropped and replaced by axe-core DOM tests (one extra dev dependency, no wrapper lib). (3) The design doc said the frontend Dockerfile builds with context `frontend/`, but the existing CI step does that while the lockfile is at the repo root; the plan switches that one CI line to repo-root context like the backend. (4) A WCAG audit of the approved mockup tokens found white text on the dark-mode button fill `#0a84ff` is 3.65:1 (needs 4.5), so the button fill gets its own token that stays `#0071e3` in dark mode, and placeholders drop their 70% opacity.
- **Decision:** Kept `react-router@8` (current major) with a smoke-import task and a documented fallback to 7.18. Flagged a risk found by reading the backend Dockerfile: adding `frontend` to the root workspaces may break `npm ci` inside the backend image; the plan includes a build check right after the workspace change.

## 2026-10-16 /speckit-tasks: 61 test-first tasks
- **Prompt:** `/speckit-tasks` for `specs/001-frontend-auth`, test-first per the constitution, in the order workspace/scaffold -> validation -> API -> tokens/UI -> session/guards -> pages -> nginx/Docker/CI/compose -> docs -> verification.
- **AI output:** `specs/001-frontend-auth/tasks.md`: 61 tasks in 9 phases (7 setup, 24 foundational, US1 2, US2 4, US3 6, US4 5, delivery 4, docs 4, verification 5), 24 parallelisable, every implementation task preceded by a red test task, plus an image-verification script as the red test for the nginx/Docker work.
- **Correction:** First draft put `safeReturnPath` inside the sign-up task, which made sign-in depend on sign-up and contradicted the "US1 and US2 in parallel" claim; moved it into the foundational session task. Also removed sloppy wording (a `types` entry that did not exist, a rambling CI-validation sentence) before committing.
- **Decision:** Page-level concerns that the spec groups under US3 (guards, logout, expiry, return-to) stay in US3, but `useSession`/`useStartSession` and the cancel-then-set race test are foundational because both auth pages need them to navigate.

## 2026-10-16 /speckit-implement: setup through session guards (T001-T043)
- **Prompt:** `/speckit-implement` for `specs/001-frontend-auth`, test-first (each pair: red, green, commit), no push.
- **AI output:** `frontend/` workspace, strict TS and a type-aware ESLint config that turns the constitution into rules (web storage, `document.cookie`, JSX `style`, layering imports); validation mirroring the contract, typed API client, error-to-message map, design tokens + 8 UI components, session module, sign-up / sign-in / welcome pages, guards, logout and the app shell. 247 tests, lint, typecheck and build green.
- **Correction:** (1) `react-router@8` passed the planned smoke import unchanged, so no fallback to 7.x. (2) npm resolved `jsdom` 29, not the planned 30, because the local Node 24.11 does not meet jsdom 30's engines; kept 29 (works on CI Node 22 too) and `@types/node` ^22 to match the engine. (3) The first `npm install -w frontend` of runtime dependencies silently did nothing (warning: "no workspace folder present") and had to be repeated. (4) I changed "inputs disabled while submitting" to read-only inputs: a disabled input drops focus, which would break focusing the email after a 409. (5) **Real bug found by the App-level test, not by the unit tests:** after sign-in, `GuestOnly` redirected to `/` before the page's own `navigate(from)` ran, so a visitor heading to `/?x=1` always landed on `/`. Fixed test-first by making `GuestOnly` honour the safe return path. (6) Mutation checks (remove `cancelQueries`, `setFocus`, `aria-describedby`, bump `PASSWORD_MAX`) each turned the intended tests red; one race test (`late 401`) was weak and the `late null` test is the real guard.
- **Decision:** The AI's plan had the page navigate itself after sign-in; the guard now owns the redirect too, so there are two navigations to the same target by design (the page tests render the page without guards). Backend image build was checked after the workspace change and needed no Dockerfile edit (a first attempt died with "frontend grpc server closed unexpectedly", a Docker Desktop hiccup, and passed on retry).

## 2026-10-16 Accessibility sweep, real-browser check and a back/forward-cache hole (T044-T048)
- **Prompt:** Continue `/speckit-implement`: axe and keyboard tests over every page state, then verify the real app against the real backend in Chrome (dev proxy), light/dark, responsive.
- **AI output:** `a11y.pages.test.tsx` (axe + accessible names + one `h1` + one `main` for sign-up, sign-in, welcome, splash, in initial / invalid / server-error / submitting states) and `keyboard.test.tsx` (tab order, Enter, Space on the toggle). Both passed on the first run because the earlier component tests had already covered each state, so I added more states instead of declaring victory. Real run: sign-up, reload (session kept, `document.cookie` empty, no storage keys), 401 banner with a server reference, sign-out, 320/375/480px layouts via same-origin iframes, no horizontal overflow.
- **Correction:** (1) **Real bug the tests could not see:** after signing out, Back restored the old welcome page from the browser's back/forward cache while `/api/auth/me` returned 401. Fixed test-first with a `pageshow` listener that resets the session query when `event.persisted`; the fix is verified by a unit test, not re-reproduced in the browser (the cache entry is hard to recreate on demand). (2) My first browser click missed the password field because the validation errors had already collapsed the layout; switched to element references. (3) `resize_window` did not change the viewport (maximised window), so responsive checks use iframes. (4) Light mode could not be viewed: the OS is dark and the tool cannot emulate `prefers-color-scheme`; light contrast is covered by the token test, not by eye.
- **Decision:** I did not emulate `prefers-reduced-motion` in the browser; those rules are asserted in `tokens.test.ts` and applied by CSS only. The JS bundle is 132 KB gzipped (target in the plan was about 100 KB for JS + CSS): React Router 8, React Hook Form, Zod and TanStack Query add up; I kept the dependencies and relaxed the target rather than swapping libraries late.

## 2026-10-16 nginx image, CI and compose (T049-T052)
- **Prompt:** Implement the delivery phase test-first: an image verification script first, then Dockerfile and nginx config.
- **AI output:** `frontend/scripts/verify-image.sh` (builds the image, starts a stub upstream and the image on a Docker network, asserts SPA fallback, 404 for a missing asset, the exact CSP and other headers on `/`, `/signin` and hashed assets, immutable and no-cache headers, that `POST /api/auth/signin` reaches the upstream with path `/api/auth/signin` and `Origin` unchanged, that `/api` responses carry no SPA CSP, no server version, non-root). It failed first (no Dockerfile) and passed once the image existed. `frontend/Dockerfile` (repo-root context), nginx template and shared `security-headers.conf`, one CI line, and a `web` service in the compose `app` profile.
- **Correction:** The real stack through compose answered `502` for about 40 seconds: the API container was still booting (`nginx` resolves the upstream fine; the Node process was just slow). Not a wiring bug; the README now says so. `npm audit --audit-level=high --omit=dev` passes; two moderate findings in `@nestjs/swagger`/`js-yaml` are backend dependencies and unchanged by this branch.
- **Decision:** Headers live in one included file because nginx drops server-level `add_header` in any location that declares its own (the script asserts headers on hashed assets to prove it). HSTS is deliberately not set (belongs to the TLS layer). Through the real stack, sign-up with `Origin: http://localhost:8080` returned 201, `Origin: http://localhost:5173` returned 403, and a UI sign-in through port 8080 reached the welcome page under the production CSP with no violations.

## 2026-10-16 A broad `git add` committed a file that was not mine
- **Prompt:** (none) While committing the session-guard task I ran `git add frontend specs docs`.
- **AI output:** That also staged the user's untracked `docs/postman/` collection into commit `d4a6032`, although the user had asked for their untracked files to be preserved.
- **Correction:** Noticed from a clean `git status` later. The collection holds only a placeholder test password and nothing was pushed. Rewriting local history was refused by the permission classifier, so the file was untracked again in a follow-up commit (it is still on disk, untracked) and the net diff against `origin/main` contains no postman file. The owner can squash or rewrite before pushing if they want it gone from the history.
- **Decision:** From here on commits add explicit paths only.

## 2026-10-16 /review-code on the frontend branch (T059-T060)
- **Prompt:** Run the project's `/review-code`: three parallel read-only reviewers (correctness, security vs `backend/CLAUDE.md`, contract drift), then verify each finding and fix survivors test-first. `/speckit-analyze` ran just before it.
- **AI output:** `docs/reviews/2026-10-16-frontend-review.md`: 11 findings fixed, 4 accepted with reasons, and a list of areas verified clean. The analysis found a 44px tap-target gap (FR-019) and stale artifacts. The reviewers found: sign-in dropped a 400 with field details (two reviewers, reproduced), a StrictMode-only bug that left the 401 handler on a discarded client (reproduced by a test on the real `<App>`), lost return path on the switch link, an emoji avatar glitch, a reduced-motion fallback that still slid, nginx overwriting `X-Forwarded-Proto` (reproduced with my own image script), compose rate limiting that treated every visitor as the proxy, and CI not enforcing the coverage gate the docs claimed.
- **Correction:** My own tests had hidden two of these: page tests mocked the whole API module (so a real 400 envelope never reached the page), and one race test could not fail. I added a real-client integration suite and removed the weak test. Several of my own shell edits mangled files again (backticks and `$()` inside `node -e`); I fixed them with the Edit tool and re-ran the tests, and the image script was rerun red before the nginx fix.
- **Decision:** I did not edit the constitution to match the code. Principle V says motion is limited to `transform`/`opacity` and controls are 48px; the code transitions colours/shadows and uses 44px for secondary controls (FR-019). That is the owner's call (amend as a PATCH, or tighten the code). Not fixed on purpose: client email validation looser than the server's (server is authoritative, error now visible), the compose `CORS_ORIGIN` default (fails closed; documented), unpinned image tags (same as the backend).
- **Follow-up found while verifying the fix for the proxy/rate-limit finding:** my first compose fix (`TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}`) did nothing on a normal setup. Compose also reads `backend/.env` for substitution, and the README tells people to copy `.env.example` (which has `TRUST_PROXY_HOPS=0`), so the container still got 0 (seen with `docker exec ... printenv`, then with `docker compose config` with and without the env file). Renamed the variable to `API_TRUST_PROXY_HOPS`, re-checked that the container gets 1, and signed up through nginx (201). Lesson: verify a config fix in the running container, not only in the file.

## 2026-10-16 Clean branch without the stray postman file
- **Prompt:** Build a new local branch from `origin/main` that carries the final frontend work with no `docs/postman` content anywhere in its history; keep `feat/frontend-auth` untouched; never use `git add .`/`-A`.
- **AI output:** A script (plumbing only: `read-tree` into a scratch index, `rm --cached docs/postman`, `write-tree`, `commit-tree` with each commit's original author, committer, dates and message) replayed the 32 commits onto `origin/main` as `feat/frontend-auth-clean`. It skipped the one commit that only untracked the file (empty after filtering), so 31 commits remain. It never touches the working tree, so the owner's untracked `docs/postman/` and `.claude/skills/apple-design/` stayed on disk.
- **Correction:** My first draft set the author/committer variables as prefixes of a bare `PARENT=$(git commit-tree ...)`, which would not have exported them to the command substitution (every commit would have had the current identity and date); switched to `env VAR=... git commit-tree` before running. The earlier attempt to rewrite history with `filter-branch` had been blocked by the permission classifier; building a new branch needed no rewrite of the old one.
- **Decision:** Proof: `git diff feat/frontend-auth feat/frontend-auth-clean` is empty (identical tree `dbc3f0b`), `git rev-list --objects` on the new branch lists no postman path or blob, `origin/main` is an ancestor and `origin/main..new` is 31 commits. The old branch still points at `b2030a5` as a backup. The commit hashes quoted in the entry above and in `AI.md` refer to that backup branch.

## 2026-10-16 Constitution Principle V amended to 1.0.1
- **Prompt:** Amend Principle V (PATCH): primary controls 48px, secondary 44px as FR-019 requires; allow subtle colour/box-shadow state transitions of about 200ms or less; keyframe/position motion stays `transform`/`opacity`; keep reduced-motion/transparency/contrast; bump the version, align `ui-tokens.md` and the quickstart; do not redesign the UI.
- **AI output:** Rewrote Principle V, added an Amendments note and set `Version: 1.0.1` (Last Amended unchanged, same day). Aligned `contracts/ui-tokens.md` (control heights, duration ceiling, motion rule), `quickstart.md` scenarios 11-12, `tasks.md` T048, `plan.md` and `frontend/CLAUDE.md` version references, and resolved the "owner decision needed" item in the frontend review.
- **Correction:** Writing the rule made me check it against the code instead of only the prose: `body` faded colours over 400ms and the checklist dot used `duration-250` for background/border colour, both above 200ms. A new "motion budget" test in `tokens.test.ts` (scans `index.css` outside the reduced-motion block and every component `transition-*` plus `duration-*` class) failed red on exactly those two, then passed after changing them to 200ms. No layout or visual redesign.
- **Decision:** PATCH as the owner proposed. Counter-view recorded in the Amendments note: it relaxes one MUST, which a stricter reading would call MINOR.

## 2026-10-16 nginx forwarding headers: safe edge default, trusted opt-in
- **Prompt:** Make the backend see the right client identity and scheme without trusting client-supplied forwarding headers: overwrite `X-Forwarded-For` with `$remote_addr` and take the scheme from `$scheme` by default, with a documented opt-in for a trusted load balancer; keep `TRUST_PROXY_HOPS` consistent; extend `verify-image.sh` first (red); prove with a real test through the stack.
- **AI output:** `FORWARDED_HEADERS_MODE=edge|trusted` (Dockerfile `ENV`, rendered into `default.conf.template` as `include /etc/nginx/forwarded-${FORWARDED_HEADERS_MODE}.conf`). `edge` overwrites `X-Forwarded-For`, `-Proto` and `-Host` from the socket and blanks `X-Real-IP`/`Forwarded`; `trusted` appends to `X-Forwarded-For` and honours `X-Forwarded-Proto` only when it is `http` or `https`; an unknown value makes nginx refuse to start. Compose passes `WEB_FORWARDED_HEADERS_MODE` (default `edge`); trusted needs `API_TRUST_PROXY_HOPS=2`. README, ADR 0007 and research updated.
- **Correction:** The script's old assertion required `X-Forwarded-Proto: https` to pass through in the default configuration; that was the behaviour I added during the review and it is only right behind a load balancer, so it moved into the trusted-mode block and the default now asserts the opposite. The red run reproduced the hole: a client sending `X-Forwarded-For: 203.0.113.7` plus two more entries reached the upstream as `203.0.113.7, 198.51.100.9, 192.0.2.1, 172.21.0.1`.
- **Decision / evidence:** Real stack (compose `app` profile, hops=1, edge): 12 wrong-password sign-ins through :8080, each with a different spoofed `X-Forwarded-For`, gave 401 x10 then 429 x2, so the spoof did not change the rate-limit bucket or `req.ip`; the same 12 straight at the API port gave 401 x12, which shows the test can detect spoofing and why the API stays published on loopback only. With `NODE_ENV=production` (scratch override), a sign-up with a spoofed `X-Forwarded-Proto: https` reached the API as `x-forwarded-proto: http` and got no `Secure` cookie. With `WEB_FORWARDED_HEADERS_MODE=trusted` and hops=2 the same request reached the API as `203.0.113.7, 172.21.0.1` / `https` and got `Set-Cookie: sid=...; HttpOnly; Secure`. Docker Desktop NATs host connections, so locally every browser request shares one peer address (and one bucket); that is the network, not the configuration.

## 2026-10-16 T058 in real Chrome: Back after sign-out reproduced, and a second, different Back bug found
- **Prompt:** Finish T058 in real Chrome through nginx; reproduce the Back-after-sign-out bug and verify the `pageshow` fix in the browser, not only by unit test.
- **AI output:** Scenarios 1-4, 8 and 13 pass through nginx (redirect, blur validation, no API call on invalid submit, sign-up 201 with a lowercased email, reload keeps the session, `/signin` and `/signup` redirect when signed in, no cookie or storage visible to script). Bug 1 (back/forward cache): parked the welcome page in the bfcache by navigating to `/healthz`, ended the session from that document with a logout fetch, then went Back. The real pre-fix bundle (built from the parent of the fix commit, served by the same nginx image) restored the welcome page with the user's email while `/api/auth/me` answered 401; the fixed bundle redirected to `/signin`.
- **Correction:** (1) My first attempt to simulate "pre-fix" with a capture-phase `pageshow` listener that stops propagation did not disable the app's listener (the app still redirected), so it proved nothing; I built the real old bundle instead. (2) Bug 2, found while checking quickstart scenario 5: when Back reloads the document from history (bfcache not used), the browser answered `GET /api/auth/me` from its HTTP cache (`transferSize` 0, a cached 200) because the API sends only an `ETag` and no `Cache-Control`; the welcome page showed again while the server said 401. The unit tests could not see it. Fixed test-first: every API request now sends `cache: 'no-store'` (red: two failing tests, then green, 275 tests). Controlled in the browser on a fresh origin each time (Chrome keeps the first `index.html` it cached per origin, which skewed my first two attempts): the build without the change replays the cached 200; the fixed build goes to the network and lands on `/signin`.
- **Decision:** The root cause is on the backend (an auth endpoint should send `Cache-Control: no-store`); the constitution says the frontend must not require backend changes, so the client defends itself and the backend change is reported to the owner as a separate follow-up, not made here. Forcing the non-bfcache path needed an `unload` listener on the page; the tool's `back` action could not see history in a fresh tab, so `history.back()` was called from the page.

## 2026-10-16 T058 finished: remaining scenarios, light/reduced-motion emulation, gates
- **Prompt:** Finish all quickstart scenarios 1-14 in real Chrome, including light mode and reduced motion (try a separate Chrome with flags or another emulation route; ask rather than skip), the rate limit through nginx, then re-run every gate and report numbers.
- **AI output:** Through nginx in the Chrome tool: duplicate email (message on the email field, values kept, email focused), wrong password and unknown email (the same "Invalid email or password." with a server reference each time), the 10/min limit through nginx ("Too many attempts. Try again in a minute." with a reference on the 11th submit), backend stopped (sign-in: "Something went wrong. Try again.", no reference, values kept; reload: "Couldn't reach the server." and Retry recovered once the API was back), keyboard-only order (Name, Email, Password, Show, Create account, Sign in) with a visible focus ring and Space on Show. Vite dev proxy: scenarios 1, 3, 4, 5, 8 and 13 (empty `document.cookie`, no storage keys, `HttpOnly; SameSite=Lax` from the real `Set-Cookie`). Light mode, reduced motion, reduced transparency, more contrast and 320/375/1280px: a scratch DevTools-protocol harness (separate headless Chrome on a throwaway profile, Node's built-in WebSocket, nothing added to the repo; screenshots and results stayed in the scratchpad).
- **Correction:** (1) The OS here reports `prefers-reduced-motion: reduce` by default (Windows animation setting), so my first harness run labelled "normal" was already reduced; the harness now sets every media feature explicitly. (2) Screenshots taken 120ms into the 500ms rise-in looked washed out; they are now taken after the animation. (3) Measuring tap targets with `getBoundingClientRect` included the in-flight scale animation (43/47px); layout size via `offsetWidth/Height` is the right measure. The measurement found one real gap: the footer "Sign in" link was 43px wide at 320px (fixed test first with `min-w-11`). (4) I ran compose once with a placeholder `SESSION_SECRET` exported in my shell; the API correctly refused to start, and I restarted it with a real secret.
- **Decision / evidence:** Real emulation results: reduced motion turns the 500ms `rise` into a 200ms opacity-only `fade-only` and button transitions to 1ms; reduced transparency makes the top bar solid (`rgb(28 28 30)`, no blur) against `rgba(...,.72)` with `blur(24px)` otherwise; more contrast changes `--color-line` to `#0009`; light mode `#f5f5f7` / `#1d1d1f`; all 19 view/state combinations have no control under 44px in either dimension, primary controls are 48px, and there is no horizontal overflow at 320px. Gates (clean `npm ci`): backend lint, typecheck, OpenAPI lint (one pre-existing `info-license` warning), 135 unit and 87 integration tests (isolated `auth_test_*` databases on a throwaway compose Mongo, not the native one), backend build; frontend lint, typecheck, 275 tests, coverage 98.8/95.59/98.14/99.55 % (statements/branches/functions/lines), build; `npm audit --audit-level=high --omit=dev` exits 0 (2 moderate in backend dependencies, unchanged); `verify-image.sh` passes; compose smoke: sign-up 201 through :8080, 403 with `Origin: http://localhost:5173`. Dev-mode scenarios 2, 6, 7, 9, 10, 12 and 14 were not repeated against Vite because they exercise the same SPA code; they ran through nginx.

## 2026-10-16 CI flake: session store closed while its TTL index was still being built
- **Prompt:** PR #4 backend integration run failed in `test-app.int-spec.ts` ("cleans up and rethrows when initialisation fails"): `MongoClientClosedError: Operation interrupted because client was closed` at `SessionStoreService.onModuleDestroy`, 86 of 87 passing.
- **AI output:** Root cause found before any fix: `connect-mongo` connects and then builds the TTL index in the background (`store.collectionP`); `onModuleDestroy` closed the client without waiting for it, so a test app that is closed straight after boot (the second app in that spec) races the `createIndex`. It did not reproduce in five local runs of the spec; a scratch script that creates the store and closes it immediately did (`MongoExpiredSessionError` locally, the same family as CI's error). Fix: `onModuleDestroy` awaits `store.collectionP` (errors swallowed) before `store.close()`.
- **Correction:** My first reading of the stack trace blamed the failed-init path (`SESSION_SECRET: 'short'`); that path throws in config validation before any store exists, so the failing close was the second, healthy app's. Test first: `test/session-store.int-spec.ts` builds the real service ten times, destroys it immediately and requires `collectionP` to resolve; it failed red with `MongoExpiredSessionError` before the fix and passes after.
- **Decision:** Fixed in the service rather than adding a sleep or retry to the test helper, because production shutdown has the same race. Gates after the fix: 88 integration, 135 unit, lint and `tsc` clean.
