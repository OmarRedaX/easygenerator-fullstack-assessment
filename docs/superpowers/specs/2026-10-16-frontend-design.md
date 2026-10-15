---
title: Easygenerator Full Stack Assessment — Frontend Design
status: draft-for-review
date: 2026-10-16
scope: frontend/ (React + TypeScript), consumes the finished backend
parent: 2026-10-15-auth-assessment-design.md
---

# Frontend Design

Extends `2026-10-15-auth-assessment-design.md` (phase 4, "Frontend"). API truth is `contracts/openapi.yaml`;
repo rules are in the root `CLAUDE.md`. This document is the input to spec-kit (see section 10).

## 1. Intent and success criteria

**Goal.** A React + TypeScript sign-up / sign-in / application module against the cookie-session backend, with a
premium, Apple-inspired interface. Reviewers score functionality, production-readiness, code quality, delivery
speed and bonus items; `AI.md` is judged on judgement.

**Success criteria.**
- Sign up (email, name ≥ 3, password ≥ 8 with letter, digit, special), sign in, an application page showing
  "Welcome to the application." with a working logout, end to end against the real backend.
- Validation, loading and error states exist for every form, are accessible, and show the server's per-field
  errors and request reference where one exists.
- Strict TypeScript, lint and tests pass; the CI frontend job (install → lint → typecheck → test → build) is green.
- The UI matches the approved mockup (`.superpowers/brainstorm/*/content/visual-direction.html`, not committed):
  one cohesive direction for all three pages, light and dark, responsive down to 320px.
- No unnecessary dependencies.

**Non-goals.** Password reset, email verification, profile editing, i18n, an in-app theme toggle (the OS theme is
followed), end-to-end browser tests, cross-site hosting.

## 2. Backend connection (decision A)

The browser only ever talks to **`/api`** on its own origin.

- **Base path.** The fetch client's base path is `/api`. The backend already serves every route under `/api`,
  so **both proxies must preserve the prefix**: Vite `server.proxy['/api']` forwards to `http://localhost:3000`
  with no `rewrite`, and nginx uses `location /api/ { proxy_pass http://backend:3000; }` with no URI part on
  `proxy_pass`, so the path is passed through unchanged.
- **CORS_ORIGIN.** The CSRF guard compares the request's `Origin` (or `Referer`) with `CORS_ORIGIN` even when the
  request arrives through a same-origin proxy, so the value must be exactly the browser-visible site origin:
  `http://localhost:5173` in development, the real `https://…` site origin in production. Proxies must forward
  the `Origin` header unchanged. They must not rewrite, drop or replace it.
- **Credentials.** `fetch(..., { credentials: 'same-origin' })`. No tokens exist on the client; the `sid` cookie
  is `httpOnly` and never readable.
- **Production.** `frontend/Dockerfile`: multi-stage (Node 22 build → `nginxinc/nginx-unprivileged` serving
  `dist/` with SPA fallback to `index.html`, proxying `/api/`). Same-site only, as in the parent spec.
- Rejected: calling `localhost:3000` directly (needs CORS plus an API-URL variable, and diverges from production).

## 3. Stack

Vite, React 19, TypeScript `strict` + `noUncheckedIndexedAccess`, `react-router`, React Hook Form + Zod
(`@hookform/resolvers`), TanStack Query, Tailwind CSS v4 (`@tailwindcss/vite`). ESLint (typescript-eslint,
react-hooks, jsx-a11y). Tests: Vitest, Testing Library, user-event, jsdom. **Not used:** MSW, an animation
library, a component library, a CSS-in-JS library, a global state library. New dependencies need a stated
reason in the PR.

```
frontend/
  index.html  vite.config.ts  tsconfig*.json  eslint.config.js  Dockerfile  nginx.conf
  src/
    main.tsx  App.tsx            # providers + router
    styles/index.css             # Tailwind @theme tokens, base styles, keyframes
    lib/api/{client.ts,auth.ts,errors.ts}
    lib/validation/{password-policy.ts,schemas.ts}
    features/auth/{SignUpPage,SignInPage}.tsx  useSession.ts  RequireAuth.tsx  GuestOnly.tsx
    features/home/WelcomePage.tsx
    components/ui/{Button,Field,PasswordField,PasswordRules,Alert,Spinner,Logo}.tsx
    test/                        # setup, render helpers
```

Each unit has one purpose and a narrow interface. `lib/api` knows HTTP and the error envelope and nothing about
React; features know pages and flows; `components/ui` knows presentation and nothing about auth.

## 4. API client and errors

- `client.ts`: `request<T>(method, path, body?)` over `fetch`; sends JSON, parses JSON, returns `undefined` for
  204. Paths are written as `/auth/me` and prefixed with the `/api` base in one place.
- Non-2xx → `ApiError { status, message, details?, requestId? }` built from the backend envelope
  `{ statusCode, error, message, details?, requestId }`. A non-JSON or missing body still yields an `ApiError`
  with a generic message. A rejected `fetch` (offline, DNS) → `NetworkError`, which has **no** request ID.
- `auth.ts`: `signUp`, `signIn`, `logout`, `getMe`, typed from the contract (`User`, `UserEnvelope`).
- **Request reference.** The UI shows "Reference <requestId>" only when one exists. Network errors and
  client-side validation errors never have one and show none.

| Response | Handling |
|---|---|
| 400 with `details` | map `{field, messages}` onto the matching form fields; unknown fields go to the form alert |
| 400 without `details` / 413 | form alert with the server message |
| 401 on sign-in | form alert "Invalid email or password." |
| 403 | form alert, generic ("This request was blocked. Reload the page and try again.") |
| 409 on sign-up | error on the email field: "That email is already registered." |
| 429 | form alert "Too many attempts. Try again in a minute." |
| 5xx / network | form alert "Something went wrong. Try again." |

## 5. Session and routing

- **Bootstrap.** `useSession()` is `useQuery(['me'], getMe, { retry: false, staleTime: Infinity })`. A `401` from
  `GET /api/auth/me` is a **normal signed-out result**: the query function catches it and returns `null`. It is
  not retried and not surfaced as an error. Any other failure is a real error state (retry button).
- **Race safety.** On sign-in and sign-up success the handler first
  `await queryClient.cancelQueries({ queryKey: ['me'] })`, then `setQueryData(['me'], user)`. An older in-flight
  `me` request that later resolves 401 therefore cannot overwrite the new session.
- **Routes.** `/` (welcome, `RequireAuth`), `/signin` and `/signup` (`GuestOnly`), `*` → redirect to `/`.
  `RequireAuth`: loading → full-screen splash; `null` → `<Navigate to="/signin" state={{from}} replace />`.
  `GuestOnly`: a signed-in user is redirected to `/`.
- **Logout.** Calls `POST /api/auth/logout`. After **success or 401** the `me` cache is set to `null` and the user
  lands on `/signin` (a 401 means the session was already gone). For any other failure (403, 429, 5xx, network)
  an error is shown on the page, the user stays on `/`, and `me` is invalidated to recheck the real state.
- **Mid-session expiry.** Any non-auth request answering 401 sets `me` to `null`; the guard redirects.

## 6. Validation

`lib/validation/password-policy.ts` mirrors the backend constant and the contract regex
(`^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\[-`{-~]).{8,128}$`). Special is the explicit ASCII punctuation set; a
space is not special. Zod schemas: **email** trim, lowercase, valid format, max 254; **name** trim, 3–80;
**password** 8–128 with the three classes. **Sign-in** validates presence only (the policy is not re-applied).
Forms use `mode: 'onTouched'`: errors appear on blur, then live. The same rule helpers drive the sign-up
`PasswordRules` checklist so UI and validation cannot disagree. On a failed submit, focus moves to the first
invalid field. Client validation is a convenience; the server stays authoritative.

## 7. UI system (Apple Design Skill, approved mockup)

- **Tokens** (Tailwind `@theme`): light `#f5f5f7` page / `#fff` surface / `#1d1d1f` text / `#6e6e73` secondary /
  `#0071e3` accent; dark `#000` / `#1c1c1e` / `#f5f5f7` / `#98989d` / `#0a84ff`; radius 12 (fields, buttons) and
  24 (card); 48px controls. System font stack. Display text uses negative tracking (`-0.022em` to `-0.03em`),
  body near 0, 17px inputs.
- **Components.** `Button` (primary, ghost; `loading` shows a spinner and sets `aria-busy`), `Field` (label,
  control slot, error, `aria-invalid` and `aria-describedby` wired), `PasswordField` (show/hide), `PasswordRules`
  (live checklist), `Alert` (`role="alert"`, optional reference), `Spinner`, `Logo`.
- **Pages.** Sign-up and sign-in: centered card; under 480px the card dissolves into the page. Welcome:
  translucent top bar (`backdrop-filter`) with Sign out, large "Welcome to the application." headline, signed-in
  email pill.
- **Motion.** CSS only. Card rise-in, press feedback on pointer-down (`scale(.97)`), checklist fill, error
  fade-in; compositor-friendly properties only. `prefers-reduced-motion` collapses animations;
  `prefers-reduced-transparency` makes the bar opaque; `prefers-contrast: more` strengthens borders.
- **Accessibility.** Real `<label>`s, `autocomplete` values (`name`, `email`, `new-password`,
  `current-password`), visible focus ring, error text not conveyed by colour alone, 4.5:1 contrast in both
  themes, keyboard-complete flows, `document.title` per route, `lang` set.

## 8. Testing and CI

- **Unit:** password policy at lengths 7/8/128/129, each missing class, space-is-not-special; schemas; API client
  error mapping (envelope, non-JSON body, network failure, 204); the "reference only when present" rule.
- **Component / flow (Testing Library, mocking `lib/api/auth`):** sign-up success, 409, 400 with `details`,
  client validation and focus; sign-in success, 401 banner, loading lock; `RequireAuth` / `GuestOnly`
  redirects; the `me` cancel-then-set race (a late 401 does not clear a fresh session); logout success, 401
  and failure paths.
- Coverage target 80% on `src/lib` and `src/features`.
- **CI.** Add `frontend` to the root npm workspaces and root scripts. The existing frontend job runs lint →
  typecheck → test → build; the docker job builds `frontend/Dockerfile` (no push). No deployment (as in the parent
  spec).

## 9. Risks and decisions

| Item | Decision |
|---|---|
| Frontend branch base | `feat/frontend-auth` is cut from `feat/backend-auth` because the backend is not yet on `main`; the PR targets `main` once the backend PR is merged by the owner (never merged automatically). |
| Password rule drift | Mirrored constant plus a test pinned to the contract regex. |
| Proxy rewriting `Origin` | Documented in section 2; the README adds a curl-free manual check (sign up in the browser, expect 201, not 403). |
| `.superpowers/` mockups | Added to `.gitignore`; not part of the deliverable. |

## 10. Process: spec-kit replaces the construct-spec → develop chain for the frontend

Decision from the brainstorm: `/speckit.*` drives the frontend; the existing commands stay for the backend.

1. `specify init --here --ai claude` at the **repo root** (so `/speckit.*` sits beside the existing commands;
   artifacts in `specs/001-frontend-auth/`). Reviewed before commit: `CLAUDE.md` is not overwritten.
2. `/speckit.constitution`: seeded from the root `CLAUDE.md` (strict TypeScript, tests first, git rules, AI-LOG
   duty, no unnecessary dependencies) plus section 7 principles.
3. `/speckit.specify` from sections 1–8; then `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`
   (tests first within each task), `/review-code` before the PR, `/update-docs` after.
4. Every non-trivial step is appended to `docs/AI-LOG.md`; `AI.md` is updated at the end.

This replaces the `writing-plans` handoff of the brainstorming skill, by explicit user choice.

## 11. Open items

- Frontend `Dockerfile` base images and exact nginx hardening headers are chosen in `/speckit.plan`.
- ESLint rule set is chosen in `/speckit.plan`.
