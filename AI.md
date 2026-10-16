# AI.md

Everything below traces to an entry in [`docs/AI-LOG.md`](docs/AI-LOG.md), which was appended to as the work
happened. Entry titles are quoted so each claim can be looked up.

## Overview

The backend (NestJS + MongoDB sign up / sign in) and the React frontend were built with Claude Code. The workflow was docs first: a design
spec, then an implementation plan, then test-first implementation task by task, then a multi-reviewer review gate.
The AI wrote most of the code. I made the security decisions, and the log records where I overrode it and where its
output was wrong.

## Where AI was used

| Area | What the AI generated | How it was verified |
|---|---|---|
| Design spec and plan | Auth design, endpoint list, 16-task implementation plan | I reviewed the security choices and overrode several (below) |
| Backend code (config, users, auth, sessions, CSRF, health) | Implementation from the plan, test first | Unit tests plus integration tests against a real MongoDB; each task ran lint, strict typecheck and build |
| Test suites | Unit, integration, security (CSRF/CORS/limits) and contract-drift suites | Red-then-green runs; the review gate mutation-tested the session-destroy assertions |
| OpenAPI contract, Dockerfile, CI, docs | Contract, multi-stage non-root image, workflow, README, ADRs | Redocly lint, image build and run (uid 1000, health check), action-validator, the README curl flow executed against the built app |
| Code review | Three parallel reviewers (correctness, security, contract drift) | Each finding reproduced or refuted before any fix; see `docs/reviews/` |

## Workflow

- `CLAUDE.md` (root and `backend/`) holds the locked stack, layering and Security rules; three skills
  (`auth-session-security`, `nest-module-conventions`, `mongo-integration-testing`) and five commands
  (`/brainstorm`, `/construct-spec`, `/develop`, `/review-code`, `/update-docs`) live in `.claude/`.
- Spec (`docs/superpowers/specs/`) then plan (`docs/superpowers/plans/`) then `/develop`: write the failing test, see
  it fail, minimal code, see it pass, commit.
- The AI log duty: every non-trivial step appends Prompt / AI output / Correction / Decision.

## Prompts that worked

- "Execute Task N exactly as written, run its verification steps": caught plan defects early because the plan's own
  commands were run (lint, compose, build) instead of trusting the plan text. See "Plan contract failed its own lint".
- Asking the reviewers for concrete `file:line` defects with a failure scenario, then refuting each one by running
  it, found the form-body limit bypass that the earlier test-first tasks had missed. See "Review gate findings".
- "Fix the code, not the test, unless the test contradicts the spec" in the security suite: both failures were real
  code defects. See "CORS echoed to foreign origins and malformed JSON lost its message".

## Corrections and rework

From the log, in order:
- Session mechanism, argon2, CSRF, hosting topology, secret and special-character wording, absolute expiry, and
  one repo vs monorepo: design-phase corrections (next section).
- `gh` CLI missing: used the GitHub MCP tools instead.
- Case-only folder rename blocked by other processes; asked me instead of killing them.
- Added `.gitattributes` for LF endings (an addition beyond the plan).
- Nest 12 (ESM-only) broke Jest; locked to Nest 11.
- Root test scripts did not forward arguments; added ` --`, quieted dotenv, ignored `*.tsbuildinfo`.
- `incremental: true` plus `deleteOutDir` made the second build emit no `dist/`; `@types/node` pinned to 22; a
  dropped regex backslash restored.
- Env placeholder check missed base64-wrapped placeholders; `ConfigModule.forRoot` returns a Promise.
- argon2 0.45 typings (`HashOptions`) and PHC parameter order (`m,p,t`); a dropped special-character backslash.
- `jest --selectProjects` swallowed the file pattern; the reviewer's own suggested fix did not work, so it was
  re-verified and replaced.
- Mongo driver handshake failed under Jest (`--experimental-vm-modules`), `testTimeout` ignored inside `projects`;
  fixed in test tooling only. `UsersModule` exports only the service.
- CORS echoed our origin to every caller; malformed JSON lost its message because Nest rewrites `SyntaxError`.
- Plan contract failed its own lint; compose YAML invalid; port 3000 occupied.
- Review gate: urlencoded parser bypass, cookie-name validation, vacuous session tests, test env isolation,
  unauthenticated dev Mongo on all interfaces, contract and docs drift.
- No-store headers (ADR 0008): the AI wired the middleware to `AuthController` in `AuthModule`; the malformed-JSON
  test went red because the body parser answers 400/413 before routing, so it moved to
  `app.use('/api/auth', ...)` ahead of the parser and guards.
- Flaky integration suite: `SessionStoreService.onModuleDestroy` closed the Mongo client while connect-mongo was
  still connecting and building its TTL index (`MongoClientClosedError`). It now awaits the store's startup first. My
  first stress run showed 70 failures per run, which was my own exported `SESSION_SECRET=x`, not the fix; the
  failure count being nothing like the earlier 0-3 is what gave it away.

## Frontend: brainstorm, spec-kit and the Apple Design Skill

The frontend (React + TypeScript, `frontend/`) used a different workflow from the backend, chosen by me: a
brainstorm with an interactive browser mockup, then GitHub's spec-kit (`/speckit-constitution`, `-specify`, `-plan`,
`-tasks`, `-implement`) instead of the plan-then-develop commands, with the installed Apple Design Skill as the
visual authority. Entries in `docs/AI-LOG.md`: "Frontend brainstorm and design spec", "Git state check and spec-kit
scaffold", "/speckit-plan: dependency audit changed three design decisions", "/speckit-tasks: 61 test-first tasks",
"/speckit-implement: setup through session guards", "Accessibility sweep, real-browser check and a back/forward-cache
hole", "nginx image, CI and compose", "A broad `git add` committed a file that was not mine", "/review-code on the frontend
branch" (report: `docs/reviews/2026-10-16-frontend-review.md`), then "Clean branch without the stray postman file",
"Constitution Principle V amended to 1.0.1", "nginx forwarding headers: safe edge default, trusted opt-in" and "T058 in
real Chrome" (the addendum to the review lists what the browser pass found). The Apple Design Skill itself is a
third-party skill kept local in `.claude/skills/apple-design/` and deliberately not committed.

| Area | What the AI generated | How it was verified |
|---|---|---|
| Visual direction | One mockup for sign-up / sign-in / welcome plus validation, loading, error and mobile states | I approved it; the contrast audit later found a real flaw in it (below) |
| Spec, plan, tasks | spec-kit constitution v1.0.0, feature spec, plan, research, data model, contracts, 61 test-first tasks | Plan claims were checked against the registry (`npm view`) and the repo, not memory |
| Frontend code | Validation, API client, error mapping, tokens, 8 UI components, session, pages, guards, logout, nginx image | Red-then-green per task; mutation checks on the risky tests; real Chrome run against the real backend, also through the nginx image |

What I corrected or decided differently from the AI's proposal:
- **Same-origin `/api` proxy (option A)** with four tightenings I required: proxies must keep the `/api` prefix;
  `CORS_ORIGIN` must equal the browser-visible origin; a 401 from `/auth/me` is a normal signed-out result with no
  retry and sign-in/sign-up cancel the pending check before storing the user; a request reference is shown only when
  the server sent one, and logout clears the session only after success or 401.
- **Tailwind with hand-built components** over shadcn or MUI, and the Apple Design Skill as the visual standard.
- **spec-kit replaces `writing-plans`** for the frontend; the backend keeps its commands.
- The AI's own plan was wrong in places and the dependency audit caught it: `eslint-plugin-jsx-a11y` is incompatible
  with ESLint 10 (replaced by axe-core tests), TypeScript had to stay on 6.x for `typescript-eslint`, the planned
  Docker build context could not see the lockfile (CI changed to the repo root), and the approved dark-mode button
  failed WCAG (white on `#0a84ff` is 3.65:1; the fill is now a separate token that stays `#0071e3`).
- Bugs found late, not by the unit tests: the sign-in guard overrode the return path (found by an App-level test),
  and Back after sign-out restored a cached protected page (found in the real browser). The real-browser pass at the
  end found a second, different cause of the same symptom: with the document reloaded from history, `GET /auth/me`
  came from the HTTP cache because the API sends no `Cache-Control`. I reproduced it with the pre-fix build, fixed it
  on the client (`cache: 'no-store'`) and left the backend recommendation to the owner. The same pass measured a
  43px-wide footer link, and a throwaway DevTools-protocol harness gave real light-mode, reduced-motion,
  reduced-transparency and 320/375px evidence that the Chrome tool could not.
- Two of my own checks were wrong and I replaced them rather than trust them: a simulated "pre-fix" run that did not
  actually disable the fix (I built the old bundle instead), and a first comparison that Chrome's per-origin cache
  skewed (I used fresh origins).
- The constitution wording did not match the specified, tested behaviour (48px vs 44px controls, colour transitions).
  I made the owner choose; Principle V was amended to 1.0.1 and a test now enforces the 200ms transition bound.
- I made one process mistake: a broad `git add` staged the owner's untracked `docs/postman/` file. The branch that
  will be pushed (`feat/frontend-auth-clean`) was rebuilt from `origin/main` without that path in any commit; the
  original branch is kept locally as a backup (see the AI-LOG entries on the clean branch).

## Decisions that differ from AI suggestions

- **Cookie sessions over access JWT + rotating refresh.** The AI recommended JWT; I chose server-side sessions.
- **Fail-closed CSRF** (Origin, then Referer, otherwise 403). The AI's rule allowed requests with no Origin.
- **`Cache-Control: no-store` on `/api/auth` only (ADR 0008).** The AI recommended it on every `/api` response; I chose the narrower scope so `/health` and Swagger keep their ETags.
- **Explicit argon2 parameters** (OWASP minimum 19456 KiB / 2 / 1), not "current recommended".
- **Explicit special-character set** (space excluded) and a secret of at least 32 **bytes**, not "32 characters".
- **`absoluteExpiresAt` enforced by `SessionGuard`**, not left to cookie/TTL expiry.
- **Same-site-only topology**, stated explicitly; the AI had left it implicit.
- **Monorepo** with npm workspaces instead of two repositories.
- Also: the review gate's fixes where I kept an accepted trade-off rather than add code (listed in
  `docs/reviews/2026-10-15-backend-auth-review.md`).

## Verification

- Frontend: 275 tests in 27 files (coverage 98.8 / 95.6 / 98.1 / 99.6 % statements / branches / functions / lines,
  80% line threshold enforced on `src/lib` and `src/features`), strict typecheck, type-aware ESLint with
  constitution rules (no web storage, no inline styles, layering imports), production build, axe on every page
  state, and `frontend/scripts/verify-image.sh` against the nginx image. Quickstart scenarios 1-14 were run in real
  Chrome against the real backend through the nginx image (a subset again with the Vite dev proxy): validation,
  duplicate and unknown email, wrong password, reload, sign-out and both Back-after-sign-out bugs, backend down, the
  10/min sign-in limit through nginx, keyboard order and storage/cookie checks. Light mode, reduced motion, reduced
  transparency, more contrast and 320/375px were checked in a separate Chrome with real media emulation; the
  forwarding-header defence was proven through the compose stack (spoofed `X-Forwarded-For` / `-Proto`).
- Unit tests (129+) and integration tests against a real MongoDB in an isolated `auth_test_*` database; coverage
  98.7 / 87.5 / 98.6 / 99.7 % (statements / branches / functions / lines) against an enforced 80% threshold.
- No-store: 19 integration tests on a real MongoDB (success and error answers of the four auth endpoints, 400, 401,
  403, 409, 429, malformed JSON, a 20 kb body, `/health` untouched, the contract declaring the header). The
  shutdown-race fix was stressed with the full integration suite under 8 busy CPU loops: 3 of 4 runs failed on the
  old code, 6 of 6 passed with the fix.
- Strict typecheck, ESLint, Redocly lint of the contract, `npm audit --audit-level=high --omit=dev`.
- Docker image builds, runs as uid 1000 and passes its health check; the README curl flow was run against the
  built app; startup fails fast with a clear error for a bad secret or an unreachable database.
- The whole suite was also run against the `mongo:7` container that CI uses (see the log: a native `mongod` had
  been answering locally).

## What I would do differently

- Run each plan task's own verification command before trusting the plan text: three plan defects (contract lint,
  compose YAML, `--selectProjects`) surfaced only that way.
- Add a body-parser assertion to the first security test pass. The urlencoded limit bypass was found only at the
  review gate.
- Pin dependency versions in the plan (the unpinned install pulled ESM-only Nest 12).
- Make the contract-drift test check statuses and schemas, not only the route set (recorded as future work).
- Frontend: audit the approved mockup's contrast before building on it, not after; run the real app in a browser
  earlier (the back/forward-cache hole and the layout shift that broke my own click only showed up there); and
  stage commits with explicit paths from the start.
