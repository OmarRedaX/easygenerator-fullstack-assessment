# Easygenerator Frontend Constitution

Scope: the `frontend/` workspace (React + TypeScript) of the Easygenerator assessment monorepo. It sits under
the root `CLAUDE.md`, the API contract `contracts/openapi.yaml`, and the approved design
`docs/superpowers/specs/2026-10-16-frontend-design.md`. If they disagree, the contract wins on API behaviour and
the root `CLAUDE.md` wins on repository workflow.

## Core Principles

### I. Contract-First Integration
`contracts/openapi.yaml` is the single source of truth for every request, response and status code. The client
MUST call only operations that exist in the contract, through the fetch client whose base path is `/api` on the
page's own origin. The password policy, email limit (254) and name limits (3-80) MUST be mirrored from the
contract, with a test pinned to the contract regex, and MUST NOT be reinvented. Client validation is a
convenience; the server remains authoritative. Rationale: the backend is finished and its rules are binding.

### II. Strict TypeScript
`strict` and `noUncheckedIndexedAccess` MUST be on. `any`, non-null assertions and `@ts-ignore` are forbidden
unless the PR states the reason. API shapes MUST be typed from the contract, not inferred ad hoc. Lint and
`tsc --noEmit` MUST pass before every commit that touches `frontend/`.

### III. Test-First (NON-NEGOTIABLE)
For every task: write the failing test, watch it fail, implement, watch it pass, then commit. Required coverage:
password policy boundaries (7/8/128/129, each missing class, a space is not special), API client error
mapping, form flows (success, 400 with `details`, 401, 409, 429, network), route guards, the
`cancelQueries`-then-`setQueryData` session race, and every logout outcome. Line coverage on `src/lib` and
`src/features` MUST be at least 80%.

### IV. Same-Origin Cookie Sessions, No Client Secrets
The browser talks only to `/api` on its own origin; proxies (Vite, nginx) MUST preserve the `/api` prefix and
MUST forward `Origin` unchanged. The session cookie is `httpOnly` and is never read, copied or stored by
JavaScript. Tokens, passwords, cookies and session data MUST NOT be written to web storage, logs, error
messages or URLs. `GET /api/auth/me` returning 401 is a normal signed-out result and MUST NOT be retried.
`cancelQueries` MUST run before `setQueryData` on sign-in and sign-up. Logout MUST clear the session cache only
after success or 401; any other failure shows the error and rechecks the session.

### V. Accessible, Apple-Quality UI
The approved mockup and the Apple Design Skill are the visual standard: system font stack, size-specific
tracking, 48px controls, 12px/24px radii, light and dark themes from the OS. Every control MUST have a real
label, `autocomplete`, visible focus, `aria-invalid` and `aria-describedby` for errors, and `role="alert"` for
server errors; contrast MUST be at least 4.5:1 in both themes. Motion MUST be CSS-only, limited to `transform`
and `opacity`, give feedback on pointer-down, and honour `prefers-reduced-motion`,
`prefers-reduced-transparency` and `prefers-contrast`. Loading, empty and error states MUST exist for every
async view.

### VI. Simplicity and Minimal Dependencies
Prefer the platform and small hand-built components. Every new runtime or dev dependency MUST be justified in
the PR; MSW, animation libraries, component libraries, CSS-in-JS and global state libraries are out of scope.
Units MUST have one purpose and a narrow interface: `lib/api` knows HTTP and nothing about React, `features`
know flows, `components/ui` knows presentation and nothing about auth. YAGNI applies to every task.

### VII. Honest Error Handling
Errors MUST map to calm, specific messages (design section 4). A request reference is shown only when the
server supplied a `requestId`; network and client-validation errors show none. Stack traces, raw server
messages for 5xx and internal identifiers MUST NOT reach the user.

## Repository Workflow Constraints

- **Git.** GitHub issue, then a `feat/...` branch, then conventional commits, then push, then a PR to `main`
  with test evidence. Never commit to `main`. Never merge a PR automatically. Never commit `*.pdf`, `.env` or
  secrets. Push and PR creation require the owner's confirmation. Spec-kit scripts MUST NOT create or switch
  branches; the working branch is chosen by the owner (currently `feat/frontend-auth`).
- **AI log.** After every non-trivial AI-assisted step, append an entry to `docs/AI-LOG.md` (prompt, AI output,
  corrections, decisions that differ from the AI's suggestion). `AI.md` is assembled from it.
- **Doc placement.** Repo-wide docs in `docs/`, the API contract in `contracts/`, feature specs in `specs/`.
- **Order.** The backend is merged and green; the frontend consumes it and MUST NOT require backend changes. If
  a backend change is needed, stop and raise it as a separate issue.
- **CI.** The frontend job (install, lint, typecheck, test, build) and the docker build MUST pass. No
  deployment automation exists.
- **Quality gate.** `/review-code` runs on the branch before the PR; findings are verified, not assumed.

## Governance

This constitution supersedes ad hoc practice for `frontend/`. Amendments require a written reason, an updated
version below, and a `docs/AI-LOG.md` entry; removing or redefining a principle is a MAJOR change, adding or
materially expanding one is MINOR, and wording fixes are PATCH. Every plan (`/speckit-plan`) MUST include a
Constitution Check against Principles I-VII, and every PR description MUST state compliance or list justified
deviations. Runtime guidance lives in the root `CLAUDE.md` and the approved design document.

**Version**: 1.0.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16
