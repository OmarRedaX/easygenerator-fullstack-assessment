# frontend/CLAUDE.md — SPA rules (binding)

The frontend constitution is `.specify/memory/constitution.md` (v1.0.0); it wins over this file. The feature is
specified in `specs/001-frontend-auth/` (spec, plan, data model, contracts, tasks). API truth is
`contracts/openapi.yaml`.

Stack (locked): Vite, React 19, TypeScript strict (+`noUncheckedIndexedAccess`, pinned to the backend's 6.x because
`typescript-eslint` rejects 7), react-router, React Hook Form + Zod, TanStack Query, Tailwind CSS v4, Vitest +
Testing Library + axe-core. Forbidden: MSW, animation libraries, component libraries, CSS-in-JS, global state
libraries, new dependencies without a stated reason in the PR.

## Layering (enforced by `eslint.config.mjs`)
`src/lib/**` is framework-free (no React, router or TanStack): HTTP, errors, validation. `src/components/ui/**` is
presentation only (no `features`, no `lib/api`). `src/features/**` composes both and owns flows.

## Rules
- Test first: red test, watch it fail, implement, watch it pass, commit. Tests sit next to the code.
- Same-origin `/api` only. Proxies keep the `/api` prefix and forward `Origin`; `CORS_ORIGIN` equals the browser origin.
- Never store credentials, session data or user data in `localStorage`, `sessionStorage`, IndexedDB, cookies set by
  script or URLs (lint enforces it). The session cookie is httpOnly.
- A 401 from `GET /auth/me` is a normal signed-out result and is never retried. Sign-in/sign-up call
  `cancelQueries(['me'])` before `setQueryData`. Logout clears the session only after success or 401.
- Password and field limits mirror the contract (a test reads `contracts/openapi.yaml`); never retype them.
- Style with design tokens and Tailwind utilities only. No inline `style` attributes or scripts (production CSP).
- Every control has a label, visible focus and a 44px+ target; errors use `role="alert"`; motion is CSS only and
  respects `prefers-reduced-motion` / `-transparency` / `-contrast`.
- Show a request reference only when the server sent one. Never show server text for 5xx.
