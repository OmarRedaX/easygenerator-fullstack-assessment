---

description: "Task list for the frontend auth module"
---

# Tasks: Frontend Auth Module

**Input**: Design documents from `/specs/001-frontend-auth/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md, spec.md (done). Constitution `.specify/memory/constitution.md` v1.0.1 applies to every task.

**Tests**: REQUIRED (Constitution Principle III, non-negotiable). Every implementation task is preceded by its test
task. For each pair: write the test, **run it and watch it fail for the right reason**, implement, **run it and
watch it pass**, then commit. A test task that passes before the implementation exists is wrong; fix the test.

**Organization**: Setup -> Foundational (shared, blocks all stories) -> one phase per user story -> delivery
(nginx/Docker/CI/compose) -> docs -> final verification. Paths are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 sign up, US2 sign in + welcome, US3 session/guards/logout, US4 polished accessible UI
- "(red)" = test task, must fail first. "(green)" = implementation that turns it green.

## Conventions used by every task

- Commands run from the repo root. Test one file: `npm test -w frontend -- <path>`. All gates:
  `npm run lint -w frontend && npm run typecheck -w frontend && npm test -w frontend`.
- Commit after each green pair, conventional message (`feat(frontend): ...`, `test(frontend): ...`,
  `chore(frontend): ...`), ending with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  Stay on `feat/frontend-auth`; never push, never open a PR (owner confirms first).
- No `any`, no non-null `!`, no `@ts-ignore`, no JSX `style={}`, no `localStorage`/`sessionStorage`/`document.cookie`.
- User-visible strings are exactly those in `contracts/api-usage.md` and `contracts/routes.md`.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: the `frontend` workspace exists, every tool runs, and the two plan risks are retired.

- [X] T001 Create the workspace: add `"frontend"` to `workspaces` and scripts `"dev:frontend": "npm run dev -w frontend"`, `"build:frontend": "npm run build -w frontend"` in `package.json` (leave existing backend scripts untouched); create `frontend/package.json` (`name: "frontend"`, `private`, `type: "module"`, `engines.node: ">=22.22.2"`, scripts `dev` = `vite`, `build` = `tsc -p tsconfig.json --noEmit && vite build`, `preview` = `vite preview`, `lint` = `eslint .`, `typecheck` = `tsc -p tsconfig.json --noEmit`, `test` = `vitest run`, `test:cov` = `vitest run --coverage`). Install with `npm install -w frontend react react-dom react-router react-hook-form @hookform/resolvers zod @tanstack/react-query` and `npm install -w frontend -D vite @vitejs/plugin-react typescript@^6.0.3 tailwindcss @tailwindcss/vite vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom axe-core eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals @types/react @types/react-dom @types/node`. Confirm `npm ls typescript eslint` shows a single hoisted TypeScript 6.x and ESLint 10.x. Commit `package.json`, `package-lock.json`, `frontend/package.json`.
- [X] T002 [P] Create `frontend/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `jsx: react-jsx`, `moduleResolution: bundler`, `target ES2022`, `lib [ES2023, DOM, DOM.Iterable]`, `types: ["vite/client"]` (no global test types, tests import from `vitest`), `include: [src, vite.config.ts]`, `noEmit`) and make `npm run typecheck -w frontend` pass on a one-line `frontend/src/main.tsx` stub.
- [X] T003 Create `frontend/vite.config.ts` (plugins `react()` and `tailwindcss()`; `server: { port: 5173, strictPort: true, proxy: { '/api': { target: env.API_PROXY_TARGET ?? 'http://localhost:3000' } } }` with **no `rewrite` and no `changeOrigin`**, read via `loadEnv`; `test` block: `environment: 'jsdom'`, `globals: false`, `setupFiles: ['./src/test/setup.ts']`, coverage `provider: 'v8'`, include `src/lib/**` and `src/features/**`, thresholds lines 80), `frontend/index.html` (`lang="en"`, viewport, `<meta name="color-scheme" content="light dark">`, `<div id="root">`, module script `/src/main.tsx`, **no inline script or style**), `frontend/public/favicon.svg`, and `frontend/src/styles/index.css` containing only `@import "tailwindcss";`. Verify `npm run build -w frontend` succeeds and `npm run dev -w frontend` serves 5173 (then stop it).
- [X] T004 Lint config, test-first: (red) create throw-away files under `frontend/src/__lint_fixtures__/` that each break one rule (`any`, `x!`, `// @ts-ignore`, `localStorage.setItem`, `document.cookie`, `<div style={{}} />`, `console.log`, `lib/` file importing `react`, `components/ui` file importing `../../features/auth/session`) and run `npx eslint frontend/src/__lint_fixtures__`; it must report each. (green) write `frontend/eslint.config.mjs` (flat; `@eslint/js` recommended, `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` with `parserOptions.projectService`, `eslint-plugin-react-hooks` recommended, `no-restricted-globals`, `no-restricted-properties`, `no-restricted-syntax` for JSX `style`, per-directory `no-restricted-imports` as in research R5, `eqeqeq`, `no-console`; test files may use non-null assertions) until the fixtures all fail and then **delete the fixtures** so `npm run lint -w frontend` is clean. Commit.
- [X] T005 [P] Vitest harness, test-first: (red) `frontend/src/test/harness.test.tsx` renders `<h1>ok</h1>` and asserts `toBeInTheDocument()` -> fails (no setup). (green) create `frontend/src/test/setup.ts` (`import '@testing-library/jest-dom/vitest'`; `afterEach(cleanup)`), `frontend/src/test/render.tsx` (helper `renderWithProviders(ui, { route, client })` wrapping a fresh `QueryClient` (`retry: false`) and `MemoryRouter`), and `frontend/src/test/a11y.ts` (`expectNoA11yViolations(container)` runs `axe-core` with `color-contrast` disabled and fails listing violations; add a test that it flags `<img src="x">` and passes `<button>ok</button>`). Keep the harness test.
- [X] T006 React Router smoke import (plan risk 1): (red) `frontend/src/test/router-smoke.test.tsx` imports `BrowserRouter, MemoryRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate, Link` from `react-router`, renders a `MemoryRouter` with a route that `Navigate`s with `replace` and `state={{ from: '/x' }}`, and asserts the final location and `location.state`. (green) if it fails to compile or run on `react-router@8`, install `react-router@^7.18.4` instead and re-run; record the outcome (kept 8.x or fell back) in `docs/AI-LOG.md`. Keep the test (it guards the API we rely on).
- [X] T007 Backend image check (plan risk 2): run `docker build -f backend/Dockerfile -t eg-backend:check .` now that `frontend` is a workspace. If `npm ci` fails because `frontend/package.json` is missing in the image, add `COPY frontend/package.json frontend/` next to the backend manifest copy in `backend/Dockerfile` (build stage) and rebuild until it passes; if it passes unchanged, change nothing. Then run `npm run typecheck -w backend && npm run lint -w backend` to prove the backend is unaffected. Commit any Dockerfile change as `fix(backend): keep image build working with the frontend workspace`.

**Checkpoint**: `npm ci`, `npm run lint -w frontend`, `npm run typecheck -w frontend`, `npm test -w frontend`,
`npm run build -w frontend` all pass; backend image builds. Append an `AI-LOG.md` entry for the phase.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: validation rules, the API client, tokens, shared UI components and the session module. Nothing here is
a page.

### Validation (`frontend/src/lib/validation/`, no React imports)

- [X] T008 [P] (red) `frontend/src/lib/validation/password-policy.test.ts`: `evaluatePassword`/`isPasswordValid` table: lengths 7 (invalid), 8 (valid), 128 (valid), 129 (invalid) using `Abcdef1!` padded with letters; each missing class (no letter `12345678!`, no digit `Abcdefgh!`, no special `Abcdefg1`); a space is **not** special (`Abcdef1 ` + length 8 invalid; `Abcdef 1` invalid); Unicode allowed but satisfies no class (`ÄÖÜÄÖÜ12` has no letter/special -> invalid; `Abc1234é` has no special -> invalid); every ASCII special in ``!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~`` counts; the returned object is `{ length, letter, digit, special }` (data-model PasswordRules). Must fail (module missing).
- [X] T009 [P] (red) `frontend/src/lib/validation/schemas.test.ts`: `signUpSchema` and `signInSchema`. Sign-up: `email` trim -> lowercase -> valid email -> max 254 (254 ok, 255 rejected; `"  Ada@Example.COM "` parses to `ada@example.com`); `name` trim -> 3..80 characters (`"Al"` rejected, `"  Ada "` ok after trim = 3, 80 ok, 81 rejected); `password` 8..128 with the three classes and **never trimmed** (leading/trailing spaces preserved in output). Sign-in: `email` non-empty, valid, max 254; `password` non-empty only (`"x"` accepted - the policy is not re-applied). Error `message` strings are specific (e.g. `Name must be at least 3 characters.`, `Enter a valid email address, like name@example.com.`, `Password must be at least 8 characters.`, `Password must be at most 128 characters.`, `Enter your email.`, `Enter your password.`). Must fail.
- [X] T010 [P] (red) `frontend/src/lib/validation/contract-mirror.test.ts`: read `contracts/openapi.yaml` with `node:fs` (path resolved from `process.cwd()` = the frontend workspace, because `import.meta.url` is not a file URL under jsdom; run it via `npm test -w frontend`, up to the repo root), regex-extract the `SignUpRequest` `pattern:` string, `maxLength: 254` for email, `minLength: 3`/`maxLength: 80` for name, `minLength: 8`/`maxLength: 128` for password, and assert each equals the exported constants (`PASSWORD_PATTERN`, `EMAIL_MAX`, `NAME_MIN`, `NAME_MAX`, `PASSWORD_MIN`, `PASSWORD_MAX`). Must fail.
- [X] T011 (green) `frontend/src/lib/validation/password-policy.ts`: export constants `PASSWORD_MIN = 8`, `PASSWORD_MAX = 128`, `PASSWORD_PATTERN` (the contract string ``^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\[-`{-~]).{8,128}$``), `evaluatePassword(value): PasswordRules`, `isPasswordValid`. Run T008 + the pattern assertion of T010.
- [X] T012 (green) `frontend/src/lib/validation/schemas.ts`: Zod 4 `signUpSchema`, `signInSchema` and inferred types `SignUpInput`, `SignInInput`; export `EMAIL_MAX = 254`, `NAME_MIN = 3`, `NAME_MAX = 80`; reuse `evaluatePassword` so the checklist and the schema cannot disagree. Run T009 and T010. Commit `feat(frontend): mirror backend validation rules`.

### API client (`frontend/src/lib/api/`, no React / TanStack imports)

- [X] T013 [P] (red) `frontend/src/lib/api/client.test.ts` (stub `globalThis.fetch` with `vi.stubGlobal`): base path is `/api` + path; `credentials: 'same-origin'`; JSON body sets `Content-Type: application/json`, no body sets no content type (logout); `204` resolves `undefined`; 200/201 returns parsed JSON; non-2xx with the full envelope -> `ApiError { status, message, details, requestId }`; envelope missing `requestId` but with an `X-Request-Id` response header -> `requestId` from the header; non-JSON/empty body -> `ApiError` with `message: 'Request failed'`, `requestId` from header or `undefined`; rejected `fetch` -> `NetworkError` with no `requestId`; `onUnauthorized` callback (registered via `setUnauthorizedHandler`) is called for a 401 only when the request did not pass `{ notifyUnauthorized: false }`, and is not called for non-401. Must fail.
- [X] T014 [P] (red) `frontend/src/lib/api/auth.test.ts` (mock `./client`): `signUp` -> `POST /auth/signup` with `{ email, name, password }` returns `User`; `signIn` -> `POST /auth/signin` with `{ email, password }`; `logout` -> `POST /auth/logout` no body; `getMe` -> `GET /auth/me`; `signUp`, `signIn`, `getMe` pass `notifyUnauthorized: false`; `getMeOrNull` returns `null` when `getMe` throws `ApiError` status 401 and **rethrows** any other error (500, `NetworkError`). Must fail.
- [X] T015 (green) `frontend/src/lib/api/types.ts` (`User`, `UserEnvelope`, `FieldDetail`, `ApiErrorBody` exactly as `data-model.md`), `errors.ts` (`ApiError` with `status`, `details?`, `requestId?`; `NetworkError`), `client.ts` (`request<T>(method, path, { body?, notifyUnauthorized? })`, `setUnauthorizedHandler`, constant `API_BASE = '/api'`; defensive body parsing per data-model). Run T013.
- [X] T016 (green) `frontend/src/lib/api/auth.ts` with `signUp`, `signIn`, `logout`, `getMe`, `getMeOrNull` (unwrap `{ user }` envelopes). Run T014. Commit `feat(frontend): add typed API client`.

### Error-to-message mapping (`frontend/src/features/auth/formErrors.ts`)

- [X] T017 (red) `frontend/src/features/auth/formErrors.test.ts`: table-driven from `contracts/api-usage.md` "Status handling": `toFormFeedback(error, 'signin' | 'signup' | 'logout')` returns `{ message, requestId?, fieldErrors }`. Cases: signin 401 -> `Invalid email or password.`; signup 409 -> `fieldErrors.email = 'That email is already registered.'`, no form message; 400 with details for `email`/`name`/`password` -> `fieldErrors` with the first message each, unknown field -> appended to `message`; 400 without details and 413 -> the server `message`; 403 -> `This request was blocked. Reload the page and try again.`; 429 -> `Too many attempts. Try again in a minute.`; 500, 503, other 4xx -> `Something went wrong. Try again.` **without** the server text; `NetworkError` -> `Something went wrong. Try again.` and `requestId` undefined; logout non-401 failure -> `Couldn't sign you out. Try again.`; `requestId` copied through only when the `ApiError` has one. Must fail.
- [X] T018 (green) Implement `frontend/src/features/auth/formErrors.ts` (pure, no React). Run T017. Commit `feat(frontend): map server errors to calm messages`.

### Tokens and shared UI (`frontend/src/styles/`, `frontend/src/components/`)

- [X] T019 (red) `frontend/src/styles/tokens.test.ts`: import the token mirror from `frontend/src/styles/tokens.ts`; assert WCAG contrast (compute from relative luminance in the test) >= 4.5 for text/page, text/surface, muted/surface, muted/page, muted/field, white/accent-fill, danger/surface, danger/page, accent/surface in **both** themes, and >= 3 for the met-rule dot (`ok`) vs surface; assert every token value in `tokens.ts` appears in `frontend/src/styles/index.css` (read as text) in the matching light/dark block; assert `index.css` contains the `@media (prefers-reduced-motion: reduce)`, `(prefers-reduced-transparency: reduce)`, `(prefers-contrast: more)` and `(prefers-color-scheme: dark)` blocks. Must fail.
- [X] T020 (green) Create `frontend/src/styles/tokens.ts` and the real `frontend/src/styles/index.css` per `contracts/ui-tokens.md` (Tailwind v4 `@theme` colour/radius/font/shadow/easing tokens; dark values redefined under `@media (prefers-color-scheme: dark)`; `--color-accent-fill` stays `#0071e3` in dark; placeholder colour = full `--color-muted`; keyframes `rise`, `fade`, `spin`; press feedback `scale(.97)`; the three accessibility media queries; base styles: `body` background/colour/font, `h1` tracking, `:focus-visible` 4px ring; `-webkit-font-smoothing`). No inline styles. Run T019. Commit `feat(frontend): add design tokens`.
- [X] T021 [P] (red) `frontend/src/components/ui/Button.test.tsx`: renders a `button` with the label; `loading` sets `aria-busy="true"`, shows the spinner, keeps the label text node, and the button is `disabled`-equivalent (clicks do nothing; use `aria-disabled` + ignore, not removed from tab order); `variant="ghost"`; fires `onClick` once on click and on Enter; has class hooks for 48px height (`h-12`); axe passes. Must fail.
- [X] T022 [P] (red) `frontend/src/components/ui/Field.test.tsx`: `Field` renders a `<label>` bound to the control (`htmlFor`/`id`), no error -> no `aria-invalid`; with `error` -> input has `aria-invalid="true"` and `aria-describedby` pointing at an element with `role="alert"` containing the message; `PasswordField` toggles `type` between `password`/`text` with an accessible button named `Show password`/`Hide password` (`aria-pressed`) and keeps focus on the input; passes `autoComplete`; disabled state; axe passes. Must fail.
- [X] T023 [P] (red) `frontend/src/components/ui/PasswordRules.test.tsx`: renders the four items `8+ characters`, `A letter`, `A number`, `A symbol`; `met` state per item is exposed to assistive tech (visually-hidden text `met`/`not met` inside each item, not colour alone); updates when props change; the list has `aria-live="polite"`; axe passes. Must fail.
- [X] T024 [P] (red) `frontend/src/components/ui/Alert.test.tsx` (also covers `Splash`, `Logo` and `Spinner`): `Alert` has `role="alert"`, shows the message, shows `Reference <id>` **only** when `requestId` is given; `Splash` has `role="status"` with visually-hidden `Loading`, and with `error`+`onRetry` shows `Couldn't reach the server.` and a `Retry` button calling `onRetry`; `Logo`/`Spinner` are `aria-hidden`; axe passes. Must fail.
- [X] T025 [P] (green) `frontend/src/components/ui/Button.tsx` and `Spinner.tsx` per `contracts/ui-tokens.md` (utilities only, no inline style). Run T021.
- [X] T026 [P] (green) `frontend/src/components/ui/Field.tsx` and `PasswordField.tsx`. Run T022.
- [X] T027 [P] (green) `frontend/src/components/ui/PasswordRules.tsx`. Run T023.
- [X] T028 [P] (green) `frontend/src/components/ui/Alert.tsx`, `Logo.tsx`, `Splash.tsx`. Run T024. Commit `feat(frontend): add accessible UI components` once T021-T028 are green.
- [X] T029 (red) `frontend/src/components/useDocumentTitle.test.tsx`: sets `document.title` on mount, updates on change. Then (green) `frontend/src/components/useDocumentTitle.ts`. Commit.

### Session module (`frontend/src/features/auth/session.ts`)

- [X] T030 (red) `frontend/src/features/auth/session.test.tsx` (mock `src/lib/api/auth`): `useSession()` uses key `['me']`, `retry: false`, `staleTime: Infinity`, `refetchOnWindowFocus: false`; `getMeOrNull` -> `User` gives `data = User`; `null` gives `data = null` and **`getMeOrNull` is called exactly once** (no retry); a 500 gives `isError`; `useStartSession()` returns an async function that calls `queryClient.cancelQueries({ queryKey: ['me'] })` **before** `setQueryData(['me'], user)` (assert call order with spies); **race**: start a `me` fetch held open by a deferred promise, call `startSession(user)`, then reject the held fetch with `ApiError` 401, and assert the cached value is still `user`; `useClearSession()` sets `['me']` to `null`; `useRecheckSession()` invalidates `['me']`. Also (red) `frontend/src/features/auth/safeReturnPath.test.ts`: accepts `/` and `/a?b=1`; rejects `//evil.com`, `https://x`, `/signin`, `/signup`, `undefined` and non-strings, all returning `/`. Must fail.
- [X] T031 (green) Implement `frontend/src/features/auth/session.ts` (export `SESSION_KEY = ['me'] as const`, `useSession`, `useStartSession`, `useClearSession`, `useRecheckSession`; the query client itself is created in `App.tsx`) and `frontend/src/features/auth/safeReturnPath.ts`. Run T030. Commit `feat(frontend): add session state with stale-response protection`.

**Checkpoint**: validation, API client, error mapping, tokens, UI components and session are green; lint and typecheck
clean. Foundation ready; US1 and US2 can proceed in parallel, US3 and US4 after them.

---

## Phase 3: User Story 1 - Create an account (Priority: P1) MVP

**Goal**: a visitor signs up and ends up signed in on the application page, with live rules, blur validation, 409,
400-details mapping, locked submit. **Independent test**: render `SignUpPage` in a `MemoryRouter` with a stub `/`
route and mocked `src/lib/api/auth`; exercise every scenario below.

- [X] T032 [US1] (red) `frontend/src/features/auth/SignUpPage.test.tsx` (user-event; mock `src/lib/api/auth`): (1) labelled fields `Name`, `Email`, `Password` with `autocomplete` `name`, `email`, `new-password`, `h1` `Create your account`, link `Sign in` to `/signin`, document title `Create account - Easygenerator`; (2) no error is shown before a field is left; after blur: name `Al` -> `Name must be at least 3 characters.`, email `ada@example` -> `Enter a valid email address, like name@example.com.`, then errors update live on typing; (3) typing a password updates the four rules live (`abcdefgh1` -> 8+, letter, number met; symbol not met) (FR-007); (4) submitting invalid data calls no API and focuses the first invalid field (FR-008); (5) valid submit calls `signUp({ email: lowercased, name: trimmed, password: untouched })`, then `startSession(user)` and navigates (replace) to `/`, or to a safe `location.state.from`; (6) 409 -> `That email is already registered.` on the email field, other values kept, email focused; (7) 400 with details for `password` and unknown field -> field message on password and the unknown one in the alert, first invalid focused; (8) 429, 403, 500, `NetworkError` -> alert text from `contracts/api-usage.md`, `Reference <id>` only when `requestId` exists; (9) while pending: all inputs read-only (not `disabled`, so focus is kept), button `aria-busy="true"` with label `Creating account...`, a second Enter/click sends **no** second request; fields re-enable after a failure; (10) axe passes in initial, error and loading states. Must fail (page missing).
- [X] T033 [US1] (green) Implement `frontend/src/features/auth/SignUpPage.tsx` (React Hook Form, `zodResolver(signUpSchema)`, `mode: 'onTouched'`, `shouldFocusError`, `setError` for server field errors using `toFormFeedback`, `useStartSession`, `useDocumentTitle`, components from `components/ui`) using `safeReturnPath` from T031. Run T032. Commit `feat(frontend): add sign-up page`.

**Checkpoint**: US1 verified by T032 alone; the page works without the router guards.

---

## Phase 4: User Story 2 - Sign in and see the application page (Priority: P1)

**Goal**: sign in with generic failure messaging, then see "Welcome to the application." with the email.
**Independent test**: render `SignInPage` / `WelcomePage` with mocked auth module and a seeded `['me']` cache.

- [X] T034 [P] [US2] (red) `frontend/src/features/auth/SignInPage.test.tsx`: fields `Email`, `Password` (`autocomplete` `email`, `current-password`), `h1` `Sign in`, link `Create an account` to `/signup`, title `Sign in - Easygenerator`; presence-only validation (`Enter your email.`, `Enter your password.`; a 1-character password is **accepted** (FR-005)); success -> `signIn`, `startSession`, navigate (replace) to `/` or safe `from`; 401 -> `Invalid email or password.` alert identical for any email, with `Reference <id>` when supplied, password field focused, values kept; 429 -> `Too many attempts. Try again in a minute.`; `NetworkError`/500 -> `Something went wrong. Try again.` with no reference; pending state: inputs read-only, button `aria-busy="true"` labelled `Signing in...`, no double submit; Show/Hide password works; axe passes in all states. Must fail.
- [X] T035 [P] [US2] (red) `frontend/src/features/home/WelcomePage.test.tsx`: with `['me']` seeded to a `User`, renders translucent top bar with brand `Easygenerator` and a `Sign out` button, an email pill showing `user.email`, an `h1` whose text is exactly `Welcome to the application.`, supporting copy, title `Easygenerator`; long email wraps/truncates without overflow classes missing (`break-all`/`truncate` class present); axe passes. (Sign-out behaviour is tested in US3.) Must fail.
- [X] T036 [US2] (green) Implement `frontend/src/features/auth/SignInPage.tsx`. Run T034.
- [X] T037 [US2] (green) Implement `frontend/src/features/home/WelcomePage.tsx` (reads `useSession()`, `Sign out` button present but not wired yet). Run T035. Commit `feat(frontend): add sign-in and welcome pages`.

**Checkpoint**: US1 and US2 pass independently; sign-up and sign-in both reach the welcome view.

---

## Phase 5: User Story 3 - Stay signed in, be guarded, sign out (Priority: P2)

**Goal**: session survives reload, routes are guarded, logout and expiry behave as specified, and no stale response
can discard a new session.

- [X] T038 [P] [US3] (red) `frontend/src/features/auth/guards.test.tsx`: `RequireAuth`: session pending -> `Splash` (`role="status"`) and no children; `null` -> redirect to `/signin` with `location.state.from` = `pathname + search`; `User` -> children; non-401 error -> splash error with `Retry` that refetches. `GuestOnly`: pending -> splash; `null` -> children; `User` -> redirect to `/`. Navigation uses `replace` (assert `window.history.length` does not grow in a `BrowserRouter` test). Must fail.
- [X] T039 [US3] (green) `frontend/src/features/auth/RequireAuth.tsx` and `GuestOnly.tsx`. Run T038.
- [X] T040 [P] [US3] (red) `frontend/src/features/home/logout.test.tsx` (mock `src/lib/api/auth`, render `WelcomePage` inside the real `App` routes): clicking `Sign out` calls `logout()` once; button shows `Signing out...` with `aria-busy`; **204** -> `['me']` is `null` and location is `/signin`; **401** -> same as success; **403 / 429 / 500 / NetworkError** -> an `Alert` (`Couldn't sign you out. Try again.`, with reference only when present) appears above the headline, location stays `/`, `['me']` is **not** cleared and `invalidateQueries(['me'])` ran; double click sends one request; axe passes with the alert shown. Must fail.
- [X] T041 [US3] (green) Add `frontend/src/features/auth/useLogout.ts` and wire `Sign out` in `frontend/src/features/home/WelcomePage.tsx` per `contracts/api-usage.md`. Run T040.
- [X] T042 [P] [US3] (red) `frontend/src/App.test.tsx` (real `App`, mocked `src/lib/api/auth`, `MemoryRouter` via an exported `AppRoutes` plus `createAppQueryClient`): routes table in `contracts/routes.md` (`/` guarded, `/signin` and `/signup` guest-only, `*` -> `/`); signed-out visit to `/` ends on `/signin`, and after sign-in lands back on the original path (`/?x=1`) while an unsafe `from` falls back to `/`; **reload persistence**: a fresh `QueryClient` whose `getMe` resolves a `User` renders the welcome page; **mid-session expiry**: with a signed-in session, a registered `setUnauthorizedHandler` firing (401 from a non-auth call) sets `['me']` to `null` and the guard redirects to `/signin`; **race at app level**: `getMe` held open, user signs in, held request then rejects 401 -> still on `/` signed in; document titles per route; `getMe` 401 is not retried (called once); signed-in user opening `/signup` is sent to `/`. Must fail.
- [X] T043 [US3] (green) Implement `frontend/src/App.tsx` (exports `createAppQueryClient`, `AppRoutes`, default `App` with `QueryClientProvider`, `BrowserRouter`, and `setUnauthorizedHandler(() => client.setQueryData(SESSION_KEY, null))` registered once), and `frontend/src/main.tsx` (`createRoot`, `StrictMode`, import `./styles/index.css`). Run T042; then `npm run build -w frontend`. Commit `feat(frontend): add session guards, logout and app shell`.

**Checkpoint**: manual quickstart scenarios 1, 3-9 pass against the real backend (`quickstart.md`).

---

## Phase 6: User Story 4 - Polished, accessible experience (Priority: P2)

**Goal**: the pages match the approved mockup, work by keyboard and screen reader, and adapt to device settings.

- [X] T044 [P] [US4] (red) `frontend/src/a11y.pages.test.tsx`: render `App` at `/signup`, `/signin`, `/` (signed in) and in these states - empty, with field errors, with server alert, submitting, splash error - and run `expectNoA11yViolations` on each (SC-006); also assert every `input` has an accessible name, every `button` has an accessible name, and exactly one `h1` per page. Must fail only if a gap exists; if it passes immediately, add the missing-state coverage until each state is rendered.
- [X] T045 [P] [US4] (red) `frontend/src/keyboard.test.tsx`: with user-event `tab()`, the sign-up order is Name -> Email -> Password -> Show -> Create account -> Sign in link; sign-in order is Email -> Password -> Show -> Sign in -> Create-account link; Enter in any field submits once; Space/Enter toggle Show; welcome page `Sign out` is reachable and activates with Enter. Must fail only if the order differs; fix the markup, not the test.
- [X] T046 [US4] (green) Close any gaps found by T044/T045 in `frontend/src/components/ui/*`, the pages and `frontend/src/styles/index.css` (labels, `aria-*`, DOM order, visible focus, 48px/44px targets, 320px layout with no overflow: `min-w-0`, `break-words`, card `max-w-[380px] w-full`, card dissolves under 480px; `lang`, `color-scheme`).
- [X] T047 [US4] Visual verification against the mockup (use the Claude in Chrome tools; save nothing in the repo): run backend + `npm run dev:frontend`, open `/signup`, `/signin`, `/` at 320px, 375px and 1280px in light and dark (emulate `prefers-color-scheme`), with `prefers-reduced-motion` and `prefers-reduced-transparency` emulated, and compare with `.superpowers/brainstorm/*/content/visual-direction.html`. Check: tracking and sizes, 48px controls, focus ring, rules checklist animation, translucent bar vs solid bar, no horizontal scroll, dark button text legible. Fix differences in `index.css`/components with a failing token or component test first where the difference is testable. Record screenshots' conclusions in `docs/AI-LOG.md` (not images).
- [X] T048 [US4] Motion pass (Apple Design Skill rules that apply here): press feedback on pointer-down (`:active`), no input blocked during any transition, keyframe/position motion only `transform`/`opacity` (colour and shadow state transitions at most 200ms, constitution 1.0.1), rise-in <= 500ms, `prefers-reduced-motion` verified in the browser (rise-in becomes opacity only). Add a test in `frontend/src/styles/tokens.test.ts` for any rule not yet asserted. Commit `feat(frontend): polish accessibility and motion`.

**Checkpoint**: quickstart scenarios 10-13 pass; axe and keyboard tests green.

---

## Phase 7: Delivery - nginx, Docker, CI, compose (no story label)

**Purpose**: FR-022 and plan R3/R4.

- [X] T049 (red) `frontend/scripts/verify-image.sh` (POSIX shell, exits non-zero on the first failed assertion): builds `docker build -f frontend/Dockerfile -t eg-frontend:verify .`; starts a tiny upstream (`node:22-alpine` running `node -e` that answers every request with JSON `{ path, origin, host }`) and the image on a user-defined Docker network with `BACKEND_URL=http://upstream:3000`; asserts via `curl`: `GET /` 200 HTML; `GET /signin` 200 HTML (SPA fallback); `GET /healthz` 200; the SPA responses carry `Content-Security-Policy` (exact value from research R4 with no `unsafe-inline`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `GET /assets/<hashed file from index.html>` has `Cache-Control` containing `immutable`; `index.html` has `no-cache`; **`POST /api/auth/signin` with header `Origin: http://localhost:8080` reaches the upstream with `path` exactly `/api/auth/signin` and `origin` exactly `http://localhost:8080`** (prefix preserved, Origin forwarded); the `/api/...` response does **not** carry the SPA CSP; `server` header has no version; the container runs as non-root (`docker exec ... id -u` != 0). Cleans up containers and network on exit. Run it now: it must fail (no Dockerfile).
- [X] T050 (green) Create `frontend/Dockerfile` (`# syntax=docker/dockerfile:1`; stage `build` = `node:22-alpine`, copy root `package.json`, `package-lock.json`, `backend/package.json`, `frontend/package.json`, `npm ci`, copy `frontend`, `npm run build -w frontend`; stage `runtime` = `nginxinc/nginx-unprivileged:1.30-alpine`, copy `dist` to `/usr/share/nginx/html`, copy `frontend/nginx/default.conf.template` to `/etc/nginx/templates/` and `security-headers.conf` to `/etc/nginx/`, `ENV BACKEND_URL=http://api:3000`, `EXPOSE 8080`, `HEALTHCHECK` using `wget -qO- http://127.0.0.1:8080/healthz`), `frontend/Dockerfile.dockerignore` (mirror `backend/Dockerfile.dockerignore`; ignore `node_modules`, `dist`, `coverage`, `.git`, `*.pdf`, `.env*`, `.superpowers`), `frontend/nginx/default.conf.template` (listen 8080; `server_tokens off`; gzip text types; `location /api/ { proxy_pass ${BACKEND_URL}; ... }` **with no URI part**, `proxy_set_header Host $host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Origin` untouched; `location /assets/ { include security-headers; add_header Cache-Control "public, max-age=31536000, immutable"; }`; `location = /index.html` and `location /` with `no-cache` and `try_files $uri /index.html`; `location = /healthz { return 200 "ok"; }`) and `frontend/nginx/security-headers.conf` (the six headers of research R4, included in every SPA location because `add_header` is not inherited). Iterate until `frontend/scripts/verify-image.sh` passes. Commit `feat(frontend): add hardened non-root nginx image`.
- [X] T051 Update `.github/workflows/ci.yml`: in the `docker` job change the frontend step to `docker build -f frontend/Dockerfile -t eg-frontend:ci .` (repo-root context, as for the backend) and keep the `if [ -f frontend/Dockerfile ]` guard; confirm the `frontend` job's commands (`npm run lint -w frontend`, `typecheck`, `npm test -w frontend --if-present`, `npm run build -w frontend`) match the scripts from T001. Re-read the diff to confirm only that line changed, and run the exact CI commands locally in order. Commit `ci: build the frontend image from the repo root`.
- [X] T052 Add a `web` service (profile `app`, build `context: ..`, `dockerfile: frontend/Dockerfile`, `depends_on: api`, `ports: ["${WEB_PORT:-8080}:8080"]`, `environment: BACKEND_URL: http://api:3000`) to `backend/docker-compose.yml`, and a comment above `CORS_ORIGIN` that it must equal the browser-visible origin (`http://localhost:8080` with `web`). Verify `docker compose -f backend/docker-compose.yml --profile app config` is valid and, with `CORS_ORIGIN=http://localhost:8080`, sign up through `http://localhost:8080` end to end (quickstart section 5). Commit `feat(frontend): add web service to the compose app profile`.

**Checkpoint**: image verified by script; CI-equivalent commands pass locally; quickstart section 5 passes.

---

## Phase 8: Docs and process (no story label)

- [X] T053 Update `README.md`: a Frontend section (stack, `npm run dev:frontend`, `API_PROXY_TARGET`, scripts, tests and coverage, why `strictPort`, `CORS_ORIGIN` must equal the browser-visible origin and what a 403 on sign-up means, production image and HSTS belongs to the TLS layer), add the `frontend/` tree to the file-architecture section, link `specs/001-frontend-auth/quickstart.md`. Keep the existing backend text unchanged.
- [X] T054 [P] Add `frontend/CLAUDE.md` (short, binding: stack, layering rules enforced by lint, "constitution wins", test-first, tokens only, no inline styles/web storage) and a note in the root `CLAUDE.md` "Workflow" section that the frontend is driven by spec-kit (`/speckit-constitution` -> `/speckit-specify` -> `/speckit-plan` -> `/speckit-tasks` -> `/speckit-implement`) while the backend keeps its commands. Do not change any other rule.
- [X] T055 [P] Add an ADR `docs/adr/0007-frontend-same-origin-proxy.md` (follow the numbering and format of the existing ADRs - read `docs/adr/` first): same-origin `/api` via proxy, `strictPort`, `Origin` forwarding, `CORS_ORIGIN` rule, rejected direct cross-origin calls. Update `docs/system-design.md` with the frontend component and request flow in the same style as the existing sections.
- [X] T056 Update `docs/AI-LOG.md` with entries for: the react-router outcome (T006), the backend Docker check (T007), any test that passed on first run and was strengthened, every correction found by the red/green cycles, the visual verification findings (T047), and any decision that differed from the AI's suggestion. Then update `AI.md` (assembled from the log - read its current structure first and extend the same sections: which parts were AI-assisted, effective prompts, corrections, overrides) with the frontend/spec-kit/Apple Design Skill story. Do not rewrite the backend content.

---

## Phase 9: Final verification (no story label)

- [X] T057 Run every gate from a clean state: `rm -rf node_modules frontend/dist frontend/coverage && npm ci`, then `npm run lint`, `npm run typecheck`, `npm run lint:api -w backend`, `npm run test:unit`, `npm run test:int` (needs MongoDB), `npm run build` (backend, root script), then `npm run lint -w frontend`, `npm run typecheck -w frontend`, `npm run test:cov -w frontend` (>= 80% lines on `src/lib` and `src/features`), `npm run build -w frontend`, `npm audit --audit-level=high --omit=dev`, `bash frontend/scripts/verify-image.sh`. Fix anything red at its root cause. Paste the summary lines (test counts, coverage %) into your report.
- [ ] T058 Run the full `quickstart.md` manual scenarios 1-13 (+14 optional) in a real browser against the real backend, in both the dev setup and the nginx setup (section 5). Tick them off in your report; any failure becomes a new red test first.
- [X] T059 Analyse consistency: run the `speckit-analyze` skill on `specs/001-frontend-auth` (read-only) and resolve any CRITICAL finding in the spec/plan/tasks or the code; note remaining LOW findings in the report.
- [X] T060 Run `/review-code` on the branch (correctness, security and contract-drift reviewers in parallel, then adversarial verification of each finding). Fix confirmed findings test-first, record accepted-not-fixed items in `docs/reviews/2026-10-16-frontend-review.md` (same format as the backend review).
- [X] T061 Final git hygiene: `git status` shows no stray files (no `.superpowers/`, `*.pdf`, `.env`, coverage output); `git log --oneline main..HEAD` reads as conventional commits; **stop here**. Report to the owner with the test evidence for the PR description. Pushing the branch and opening the PR to `main` happen only after the owner confirms.

---

## Dependencies and execution order

- Phase 1 -> Phase 2 -> (Phase 3 and Phase 4 in parallel) -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8 -> Phase 9.
- Phase 2 internal: Validation (T008-T012), API client (T013-T016), error mapping (T017-T018, needs T015), tokens (T019-T020) and UI components (T021-T029, needs T020) can run as parallel streams; the session module (T030-T031) needs T016.
- US1 (T032-T033) and US2 (T034-T037) each need only Phase 2 and can run in parallel. US3 (T038-T043) needs US1 and US2 (the real `App` routes include both pages). US4 (T044-T048) needs US1-US3.
- Phase 7 needs `npm run build -w frontend` working (T043). T052 needs T050. Phase 8 needs the behaviour it documents. Phase 9 is last.

### Parallel opportunities

- T002 and T005 after T001; T008, T009, T010 (three red tests, different files); T013 and T014; T021-T024 (four UI red tests) and later T025-T028 (four UI green tasks); T034 and T035; T038 and T040 and T042 (reds); T044 and T045; T054 and T055.

### Implementation strategy

1. **MVP = Phases 1, 2 and 3** (US1): a working, tested sign-up page. Demo-able but not yet reachable via routes.
2. Add US2, then US3 for the full product loop (the assessment's functional requirements are complete after Phase 5).
3. US4 and Phase 7 raise it to production quality; Phases 8-9 close the delivery (docs, AI.md, review, evidence).
4. Commit after every green pair; run lint + typecheck + the touched tests before each commit; run the full suite at each checkpoint.

## Notes

- Every red test must be seen failing for the intended reason before implementing (Constitution III). If a "red" test passes immediately, strengthen it.
- Conflicts: the constitution beats this file; the OpenAPI contract beats both on API behaviour.
- Never `git push`, `gh pr create`, switch branches, or commit `*.pdf`, `.env`, secrets, `.superpowers/`.
