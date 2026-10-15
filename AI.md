# AI.md

Everything below traces to an entry in [`docs/AI-LOG.md`](docs/AI-LOG.md), which was appended to as the work
happened. Entry titles are quoted so each claim can be looked up.

## Overview

The backend (NestJS + MongoDB sign up / sign in) was built with Claude Code. The workflow was docs first: a design
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
  it, found the form-body limit bypass that nine earlier tasks had missed. See "Review gate findings".
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

## Decisions that differ from AI suggestions

- **Cookie sessions over access JWT + rotating refresh.** The AI recommended JWT; I chose server-side sessions.
- **Fail-closed CSRF** (Origin, then Referer, otherwise 403). The AI's rule allowed requests with no Origin.
- **Explicit argon2 parameters** (OWASP minimum 19456 KiB / 2 / 1), not "current recommended".
- **Explicit special-character set** (space excluded) and a secret of at least 32 **bytes**, not "32 characters".
- **`absoluteExpiresAt` enforced by `SessionGuard`**, not left to cookie/TTL expiry.
- **Same-site-only topology**, stated explicitly; the AI had left it implicit.
- **Monorepo** with npm workspaces instead of two repositories.
- Also: the review gate's fixes where I kept an accepted trade-off rather than add code (listed in
  `docs/reviews/2026-10-15-backend-auth-review.md`).

## Verification

- Unit tests (129+) and integration tests against a real MongoDB in an isolated `auth_test_*` database; coverage
  98.7 / 87.5 / 98.6 / 99.7 % (statements / branches / functions / lines) against an enforced 80% threshold.
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
