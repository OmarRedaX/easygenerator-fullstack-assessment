# Implementation Plan: Frontend Auth Module

**Branch**: `feat/frontend-auth` (actual git branch; the spec directory name `001-frontend-auth` is independent) | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-frontend-auth/spec.md`

## Summary

Build `frontend/`, a Vite + React 19 + strict TypeScript single-page app with sign-up, sign-in and a protected
welcome page against the merged cookie-session backend. The browser talks only to `/api` on its own origin (Vite
proxy in dev, nginx in production, `/api` prefix preserved, `Origin` forwarded). Session state lives in one
TanStack Query entry (`['me']`; a 401 is a normal signed-out value; sign-in/sign-up cancel-then-set to avoid a stale
overwrite). Forms use React Hook Form + Zod mirroring the contract's rules. The UI is the approved Apple-inspired
mockup expressed as Tailwind v4 tokens and a small set of hand-built components, with CSS-only motion and
accessibility checked by axe in tests. Delivery includes lint/typecheck/tests/build in the existing CI job, a
non-root nginx image, and README instructions. Research (`research.md`) settled every open item.

## Technical Context

**Language/Version**: TypeScript `^6.0.3` (strict, `noUncheckedIndexedAccess`; pinned to the backend's version because `typescript-eslint` rejects TS >= 6.1), React 19.3, Node >= 22.22.2

**Primary Dependencies**: vite 8, @vitejs/plugin-react 6, react-router 8 (fallback 7.18 if the smoke import in task 1 fails), react-hook-form 7 + @hookform/resolvers 5 + zod 4, @tanstack/react-query 5, tailwindcss 4 + @tailwindcss/vite

**Storage**: N/A (in-memory query cache only; nothing persisted client-side)

**Testing**: Vitest 5 + jsdom 30 + Testing Library (react, user-event, jest-dom) + `axe-core`; `@vitest/coverage-v8`; component tests mock `src/lib/api/auth`, the client suite stubs `fetch`; no MSW

**Target Platform**: Evergreen browsers (320px to 1920px, light/dark), served by nginx-unprivileged 1.30-alpine; dev on Vite at `localhost:5173`

**Project Type**: Web application, frontend workspace of an existing npm-workspaces monorepo (backend already merged)

**Performance Goals**: Instant press feedback (state change on pointer-down); first load of the auth pages around 140 KB gzipped JS+CSS (measured: 132 KB JS + 6 KB CSS; originally targeted ~100 KB; no animation/component libraries, system fonts); sign-up to welcome page under 60 s for a user (SC-001)

**Constraints**: Same-origin `/api` only; CSP without `'unsafe-inline'` (no inline styles or scripts); no storage of credentials/session data (FR-017); reuse backend as-is (no backend change); new dependencies must be justified (Principle VI)

**Scale/Scope**: 3 pages, ~7 UI components, 4 API operations, ~25 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.* Constitution v1.0.0.

| Principle | Gate | Status |
|---|---|---|
| I Contract-First | Only the 4 contract operations are called, base `/api`; validation constants mirrored and pinned by a test that reads `contracts/openapi.yaml` | PASS (`contracts/api-usage.md`) |
| II Strict TypeScript | `strict` + `noUncheckedIndexedAccess`; typed-lint `strictTypeChecked`; no `any`/`!`/`@ts-ignore` | PASS (R5) |
| III Test-First | Every task in `tasks.md` is red -> green -> commit; coverage >= 80% on `src/lib`, `src/features`; race and logout cases listed | PASS (R6, quickstart section 4) |
| IV Same-origin, no client secrets | Proxies preserve `/api` and `Origin`; lint bans web storage and `document.cookie`; `me` 401 not retried; `cancelQueries` before `setQueryData`; logout cache rules | PASS (R2, R3, R5, R8) |
| V Accessible Apple-quality UI | Tokens + media queries in `contracts/ui-tokens.md`; axe tests on every page and state; contrast token test | PASS, with two **corrections to the mockup** (R7: dark button fill, placeholder opacity) |
| VI Simplicity / minimal deps | Runtime: react, react-dom, react-router, react-hook-form, @hookform/resolvers, zod, @tanstack/react-query. Dev: toolchain + testing + `axe-core`. No MSW/animation/UI/state libs | PASS |
| VII Honest errors | Message table in `contracts/api-usage.md`; reference only when present; no 5xx server text shown | PASS |
| Workflow constraints | Branch is `feat/frontend-auth`, spec-kit never switches branches; push/PR only with owner confirmation; AI-LOG entries; CI job covers install/lint/typecheck/test/build and docker | PASS |

Post-design re-check: no new violations. Two deliberate deviations from the design document, both recorded in
`docs/AI-LOG.md` when implemented:

1. `eslint-plugin-jsx-a11y` is omitted (peer `eslint <= 9` vs the repo's ESLint 10); axe-core DOM tests replace it.
2. TypeScript is pinned to 6.x, not the registry's 7.x (typed linting requires it).

## Project Structure

### Documentation (this feature)

```text
specs/001-frontend-auth/
├── plan.md              # This file
├── research.md          # Phase 0: versions, proxy, nginx, ESLint, tests, contrast audit
├── data-model.md        # Phase 1: types, session state machine
├── quickstart.md        # Phase 1: acceptance run
├── contracts/
│   ├── api-usage.md     # operations used, status handling, mirrored validation
│   ├── routes.md        # routes, guards, page contracts
│   └── ui-tokens.md     # colour/shape/type/motion tokens and media queries
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks - not created here)
```

### Source Code (repository root)

```text
package.json                         # + "frontend" in workspaces; + dev:frontend, build:frontend scripts
package-lock.json                    # regenerated
.github/workflows/ci.yml             # one line: frontend docker build uses the repo root as context
backend/Dockerfile                   # only if `npm ci` needs frontend/package.json after the workspace change (R3)
backend/docker-compose.yml           # + `web` service (profile app, port 8080)
README.md                            # + frontend section (run, test, ports, CORS_ORIGIN rule)

frontend/
├── package.json                     # scripts: dev, build, preview, lint, typecheck, test, test:cov
├── tsconfig.json  tsconfig.node.json
├── vite.config.ts                   # React + Tailwind plugins, /api proxy, Vitest config
├── eslint.config.mjs
├── index.html                       # lang="en", viewport, color-scheme meta, no inline script/style
├── Dockerfile  Dockerfile.dockerignore
├── nginx/
│   ├── default.conf.template        # /api proxy (prefix preserved), SPA fallback, /healthz, caching
│   └── security-headers.conf        # included by every SPA location (R4)
├── public/favicon.svg
└── src/
    ├── main.tsx                     # createRoot, providers
    ├── App.tsx                      # QueryClient, onUnauthorized wiring, router, <Routes>
    ├── styles/index.css             # @import "tailwindcss"; @theme tokens; keyframes; media queries
    ├── lib/
    │   ├── api/{client.ts,errors.ts,auth.ts,types.ts}   # no React imports
    │   └── validation/{password-policy.ts,schemas.ts}   # no React imports
    ├── features/
    │   ├── auth/{SignUpPage,SignInPage,RequireAuth,GuestOnly,useSession,useAuthActions,formErrors}.ts(x)
    │   └── home/WelcomePage.tsx
    ├── components/
    │   ├── ui/{Button,Field,PasswordField,PasswordRules,Alert,Spinner,Logo,Splash}.tsx   # no auth/api imports
    │   └── useDocumentTitle.ts
    └── test/{setup.ts,render.tsx,a11y.ts}
    # tests are colocated: *.test.ts(x) next to the unit they cover
```

**Structure Decision**: One new workspace, `frontend/`, beside `backend/`, following the layout already approved in
the design document (section 3). Layering is enforced by lint (`no-restricted-imports`): `lib/**` is
framework-free, `components/ui/**` knows nothing of auth or the API, `features/**` composes both.

## Complexity Tracking

No constitution violations to justify. The two tooling deviations above are not complexity; they remove a
dependency and a version risk.

## Risks

| Risk | Mitigation |
|---|---|
| `react-router@8` API differs from the v7 API the code assumes | Task 1 smoke-compiles the exact imports; fallback `^7.18.4` is a one-line change |
| Adding the workspace breaks `npm ci` in `backend/Dockerfile` | Build the backend image right after the workspace change; copy `frontend/package.json` into the build stage if needed; CI docker job guards it |
| Dev proxy rewrites `Origin` or the port moves (403 on every POST) | No `changeOrigin`, `strictPort: true`, README troubleshooting line, manual scenario 3 |
| CSP blocks something Tailwind/React emit | Verify in the production image (quickstart section 5); lint bans `style` props |
| Local port 3000 busy (seen in this repo) | `API_PROXY_TARGET` override, documented |
| Mockup colours fail WCAG (dark button) | Tokens corrected before implementation; contrast test locks them |
