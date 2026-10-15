# Research: Frontend Auth Module

Date: 2026-10-16. Resolves the open items of `docs/superpowers/specs/2026-10-16-frontend-design.md` (section 11)
and checks every planned dependency against the registry and the existing monorepo. Versions were read with
`npm view` on 2026-10-16.

## R1. Toolchain versions and peer compatibility

| Package | Latest | Decision | Why |
|---|---|---|---|
| vite | 8.3.4 | `^8.3.4` | `@vitejs/plugin-react@6` requires `vite ^8`; `@tailwindcss/vite` and `vitest` accept 8. |
| @vitejs/plugin-react | 6.1.2 | `^6.1.2` | Matches Vite 8. |
| react / react-dom | 19.3.1 | `^19.3.1` | Required by `react-router@8` (`>=19.2.7`). |
| react-router | 8.4.0 | `^8.4.0`, **verify in task 1** | Current major. Used in declarative mode (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `Outlet`, `useLocation`, `useNavigate`, `MemoryRouter` in tests) from the `react-router` package. Task 1 compiles a smoke import of exactly these; if any is missing, fall back to `react-router@^7.18.4` (same API, verified line) and record it in `docs/AI-LOG.md`. Needs Node >= 22.22.0. |
| react-hook-form | 7.90.0 | `^7.90.0` | Stable; `mode: 'onTouched'`, `setError`, `setFocus`. |
| @hookform/resolvers | 5.9.1 | `^5.9.1` | Peer `zod ^3.25 \|\| ^4`, `react-hook-form ^7.55`. |
| zod | 4.6.7 | `^4.6.7` | Resolvers 5 supports Zod 4. |
| @tanstack/react-query | 5.104.3 | `^5.104.3` | `cancelQueries`, `setQueryData`, `retry: false`. |
| tailwindcss + @tailwindcss/vite | 4.3.3 | `^4.3.3` | CSS-first `@theme`; no `tailwind.config.js`, no PostCSS file. |
| vitest + @vitest/coverage-v8 | 5.0.5 | `^5.0.5` | Needs Node `^22.12`; shares Vite 8. |
| jsdom | 30.1.3 | `^30.1.3` | Needs Node `^22.22.2`. |
| @testing-library/react / user-event / jest-dom | 16.3.3 / 14.6.8 / 7.0.1 | latest | `@testing-library/dom ^10` is a peer and is added explicitly. |
| **typescript** | 7.0.2 | **`^6.0.3`** (same as backend) | `typescript-eslint@8.71.2` declares `typescript <6.1.0`; TS 7 would break typed linting. One hoisted version shared with the backend workspace. |
| eslint, @eslint/js, globals, typescript-eslint | 10.12 / 10.0.1 / 17.13 / 8.71.2 | same ranges as backend | Already hoisted at the root; a second ESLint would be pure duplication. |
| eslint-plugin-react-hooks | 7.1.1 | `^7.1.1` | Peer includes `eslint ^10`. |
| **eslint-plugin-jsx-a11y** | 6.10.2 | **not used** | Peer range stops at `eslint ^9`; installing it next to ESLint 10 needs `--legacy-peer-deps`/overrides. Replaced by axe-core tests (R6), which check the rendered DOM and are stronger than static JSX rules. Recorded as a deviation in `plan.md`. |

Engines: the frontend `package.json` declares `"node": ">=22.22.2"` (strictest transitive requirement: jsdom). CI
uses `node-version: 22` (resolves to the latest 22.x) and Docker uses `node:22-alpine` (22.22).

## R2. Dev proxy

Decision: `vite.config.ts` sets `server.proxy['/api'] = { target: <API_PROXY_TARGET> }` with **no `rewrite`** and
**no `changeOrigin`** (the latter only rewrites `Host`, and leaving it off also keeps the dev setup identical to
nginx). `API_PROXY_TARGET` defaults to `http://localhost:3000`, read via `loadEnv`, so a developer whose port 3000
is taken (it happened in this repo: see the backend `API_PORT` precedent) can run `API_PROXY_TARGET=... npm run
dev`. The browser's `Origin: http://localhost:5173` passes through untouched and matches the backend's
`CORS_ORIGIN`. `server.port` is fixed at 5173 with `strictPort: true`, because the origin is a security setting; a
silently chosen 5174 would make every POST fail with 403.

Alternatives: direct cross-origin calls (needs CORS preflight handling and an API URL variable; diverges from
production) - rejected in the design (decision A).

## R3. Production image and CI

- **Build stage:** `node:22-alpine` (same as the backend image; 22.22). `npm ci` against the root lockfile and the
  workspace manifests, then `npm run build -w frontend`.
- **Runtime stage:** `nginxinc/nginx-unprivileged:1.30-alpine` (stable line, non-root uid 101, listens on 8080).
- **Build context.** The existing CI step runs `docker build -f frontend/Dockerfile ... frontend` (context =
  `frontend/`), which cannot see the root `package-lock.json`. Decision: use the **repository root as context**
  (exactly like `backend/Dockerfile`) and change that one CI line to `docker build -f frontend/Dockerfile -t
  eg-frontend:ci .`. A `frontend/Dockerfile.dockerignore` mirrors `backend/Dockerfile.dockerignore`.
- **Upstream.** nginx proxies `/api/` to `${BACKEND_URL}` (default `http://api:3000`) through the image's built-in
  `envsubst` of `/etc/nginx/templates/*.template`. `proxy_pass http://...;` has **no URI part**, so the `/api`
  prefix is preserved. `proxy_set_header Host $host` and the default pass-through of `Origin` are kept;
  `X-Forwarded-For/Proto` are added (the backend has `TRUST_PROXY_HOPS`).
- **Compose.** Add a `web` service (profile `app`) to `backend/docker-compose.yml` publishing `8080`. With it, the
  `api` service's `CORS_ORIGIN` must be `http://localhost:8080`; documented in the README, not defaulted.
- **Risk found:** adding `frontend` to the root `workspaces` changes what `npm ci` expects inside the **backend**
  image, which copies only `backend/package.json`. The plan includes a task to build the backend image after the
  workspace change and, if `npm ci` complains, add `COPY frontend/package.json frontend/` (or use `npm ci -w backend`).
  The CI docker job is the safety net.
- **Root scripts.** Existing `lint`, `typecheck`, `test:unit`, `build` stay backend-only (the backend CI job calls
  them). Add only `dev:frontend` and `build:frontend`; the CI frontend job already calls `-w frontend` scripts.

## R4. Nginx hardening headers

Applied to the SPA locations only. `/api/` responses keep the backend's own `helmet` headers (including the CSP that
Swagger UI at `/api/docs` needs), so no header is added there.

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| Cross-Origin-Opener-Policy | `same-origin` |
| X-Frame-Options | `DENY` (legacy twin of `frame-ancestors`) |

Rules that follow from this: (1) **no inline `style` attributes and no inline scripts** in the app, because the CSP
has no `'unsafe-inline'` (Tailwind emits a stylesheet file; dynamic values use classes/CSS variables set through
`className`); (2) `add_header` in nginx is not inherited into a `location` that declares its own `add_header`, so the
headers live in one `security-headers.conf` that every SPA location `include`s; (3) HSTS is **not** set here - it
belongs to the TLS-terminating layer and would be wrong on plain `http://localhost`; the README says so;
(4) caching: `/assets/*` immutable for one year (hashed names), `index.html` `no-cache`; `server_tokens off`;
gzip for text types; SPA fallback `try_files $uri /index.html`; `GET /healthz` returns 200 for the container
healthcheck.

## R5. ESLint rule set

Flat config, TypeScript type-aware (`parserOptions.projectService`):
`@eslint/js` recommended + `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` +
`eslint-plugin-react-hooks` recommended. Project-specific rules that turn the constitution into checks:

- `@typescript-eslint/no-explicit-any`, `no-non-null-assertion`, `ban-ts-comment` (on by `strict`) - Principle II.
- `no-restricted-globals` for `localStorage`, `sessionStorage`, and `no-restricted-properties` for
  `document.cookie`, `window.localStorage`, `window.sessionStorage` - Principle IV / FR-017.
- `no-restricted-syntax` forbidding JSX `style={...}` props - CSP rule (R4).
- `no-restricted-imports` per directory - Principle VI layering: `src/lib/**` may not import `react`,
  `react-dom`, `react-router`, `@tanstack/*`; `src/components/ui/**` may not import `src/features/**` or
  `src/lib/api/**`.
- `eqeqeq`, `no-console` (warn level off in tests) so nothing leaks to the console.
Test files get the `vitest` globals and relaxed non-null rules for DOM queries only.

## R6. Test strategy

- **Runner:** Vitest with `environment: 'jsdom'`, `globals: false` (explicit imports), `setupFiles` for
  `@testing-library/jest-dom/vitest` and automatic cleanup. Coverage with `@vitest/coverage-v8`; thresholds 80%
  lines on `src/lib/**` and `src/features/**`.
- **Mocking:** component and flow tests mock the module `src/lib/api/auth` (`vi.mock`), not `fetch`. A separate
  suite tests `src/lib/api/client.ts` against a stubbed `globalThis.fetch`. No MSW (constitution VI).
- **Accessibility:** a 15-line helper `src/test/a11y.ts` runs `axe-core` on a rendered container and fails on any
  violation. jsdom has no layout, so the `color-contrast` rule is disabled in that helper; contrast is covered by a
  **token test** that computes WCAG ratios from the token values (R7) so the two checks together cover
  SC-006. Only `axe-core` is added (no wrapper library).
- **Race test:** the `cancelQueries` -> `setQueryData` ordering is tested with a controllable promise: start `me`,
  complete sign-in, then reject the old `me` with 401, and assert the user is still signed in.
- **No browser/E2E tests** (out of scope). Manual end-to-end check against the real backend is in `quickstart.md`.

## R7. Contrast audit of the approved palette

Ratios computed from the mockup tokens (WCAG 2.x relative luminance):

| Pair | Ratio | Verdict |
|---|---|---|
| light text `#1d1d1f` on page `#f5f5f7` | 15.46 | pass |
| light muted `#6e6e73` on card `#fff` / on page `#f5f5f7` | 5.07 / 4.66 | pass |
| light white on accent `#0071e3` (button) | 4.70 | pass |
| light danger `#d70015` on card / page | 5.38 / 4.94 | pass |
| dark text `#f5f5f7` on card `#1c1c1e` | 15.63 | pass |
| dark muted `#98989d` on card / on field `#2c2c2e` | 5.93 / 4.85 | pass |
| dark danger `#ff6961` on card | 6.03 | pass |
| dark accent text `#0a84ff` on card | 4.66 | pass |
| **dark white on `#0a84ff` (button)** | **3.65** | **fail** - the mockup used this |

Corrections carried into the tokens (`contracts/ui-tokens.md`): the primary button **fill** is a separate token
`--color-accent-fill` that stays `#0071e3` in dark mode (white text 4.70) while `--color-accent` (`#0a84ff`) is used
for links, focus rings and the show/hide control; placeholders use the full muted colour instead of the mockup's
70% opacity. The "met" checklist dot (`#1d8a3a`, 4.42 against white text it never carries) is a graphic, held to
3:1, and the met label itself uses the normal text colour.

## R8. Remaining decisions

- **Session query:** `useQuery({ queryKey: ['me'], queryFn: getMeOrNull, retry: false, staleTime: Infinity,
  refetchOnWindowFocus: false })`. `getMeOrNull` converts an `ApiError` with status 401 into `null`.
  Refetch-on-focus is off because the session is re-verified by the server on every real request; a 401 from any
  request sets `me` to `null` (R9).
- **Global 401 handling:** the API client accepts an `onUnauthorized` callback registered once in `App`; it is
  invoked for 401s from operations other than sign-in, sign-up and `getMe` and calls
  `queryClient.setQueryData(['me'], null)`. `lib/api` stays free of React and TanStack imports (R5).
- **Return-to path:** `RequireAuth` passes `state={{ from: pathname + search }}`; after sign-in the page navigates
  to `from` only if it starts with a single `/`, does not start with `//`, and is not `/signin` or `/signup`;
  otherwise `/`.
- **Forms:** React Hook Form with `zodResolver`, `mode: 'onTouched'`, `shouldFocusError: true`. Server `details`
  are applied with `setError(field, { type: 'server', message })` for known fields (`email`, `name`, `password`),
  everything else goes to the form alert. Submit handlers ignore calls while `isSubmitting`.
- **Motion:** CSS keyframes/transitions only (`rise`, `fade`, `spin`, press scale); the mockup's cubic-bezier
  (`.2,.8,.2,1`) is the single easing token. No gesture-driven motion exists, so the skill's spring/velocity rules
  do not apply; its press-feedback, reduced-motion and reduced-transparency rules do.
- **Fonts:** system stack only; no web font download (faster, CSP-simple).
- **Page titles:** a tiny `useDocumentTitle(title)` hook in `src/components/` (no helmet library).
- **Env:** the app has no runtime env vars; the base path is a constant `'/api'`. Only the dev-only
  `API_PROXY_TARGET` exists and it is read by `vite.config.ts`, never by browser code.

All items from the plan's Technical Context are resolved; no `NEEDS CLARIFICATION` remains.
