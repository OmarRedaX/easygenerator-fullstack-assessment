# Review: `feat/frontend-auth` (2026-10-16)

Process (`/review-code`): three read-only reviewers ran in parallel (correctness, security vs the Security rules in
`backend/CLAUDE.md`, contract drift vs `contracts/openapi.yaml` and the frontend constitution). Every finding was then
checked: reproduced by a failing test or command, or refuted from the code. Survivors were fixed test-first. Before
the review, `/speckit-analyze` (read-only) had already found the 44px footer-link gap, fixed in `e688aa8`.

## Fixed (survived verification)

| # | Finding | How it was verified | Fix |
|---|---|---|---|
| 1 | Sign-in swallowed a server `400` with per-field `details`: `SignInPage` read only `feedback.message`, which is empty when every detail names `email`/`password`. A 65-char local part passes Zod but fails the backend's `IsEmail`, so the form just unlocked with no explanation (reported by two reviewers) | Two new `SignInPage` tests and a real-client integration test failed before the change | Field errors are set on the field and focused; a detail for a field this form lacks goes into the alert |
| 2 | The 401 handler was registered while creating the query client inside a `useState` initializer; React StrictMode (on in dev) runs it twice and keeps the first client, so in development a 401 from a protected request never redirected | New test renders the real `<App>` under `<StrictMode>`: red before, green after | `useClearSessionOnUnauthorized()` registers in an effect with cleanup; `createAppQueryClient()` is now pure |
| 3 | `AuthLink` dropped `location.state`: sign-in to sign-up lost the return path | New `AuthLayout` test: red before | `AuthLink` forwards the router state |
| 4 | Avatar initial used `charAt(0)`, which splits an emoji into a lone surrogate (renders a replacement glyph) | New test with a name of three emoji: red before | `Array.from(name.trim())[0]` |
| 5 | The reduced-motion fallback was not opacity-only: the shared `fade-in` keyframe has `translateY(-2px)` | New CSS test asserting an opacity-only keyframe: red before | `@keyframes fade-only`, used by the reduced-motion block |
| 6 | The weak test "a late 401 cannot overwrite the new session" could not fail without `cancelQueries` (TanStack keeps `data` on error); only the "late null" test guarded FR-013 | Mutation check earlier in the build (two tests failed, this one did not) and re-read by the reviewer | Weak test removed; the surviving test is named for what it proves (`getMeOrNull` maps a 401 to `null`) |
| 7 | Page tests mocked `lib/api/auth` entirely, so the real client to error-mapping to page chain was never exercised (finding 1 slipped through) | Consequence of finding 1 | `realClient.integration.test.tsx`: real fetch client with only `fetch` stubbed (400 details, 401 with reference, 500 with header-only request id and hidden server text, 409, 201) |
| 8 | nginx set `X-Forwarded-Proto $scheme`, so a TLS-terminating load balancer's `https` was overwritten with `http`; behind it, in production, `express-session` would refuse to send the `Secure` cookie and sign-in would fail | **Reproduced** by `verify-image.sh`: upstream saw `"xfp":"http"` for a request carrying `X-Forwarded-Proto: https` | `map $http_x_forwarded_proto $forwarded_proto` trusting only `http`/`https`; three new script assertions (no header, `https`, junk value) |
| 9 | Compose `api` had `TRUST_PROXY_HOPS=0` behind nginx and published port 3000 on all interfaces: every visitor shares the proxy address, so the 10/min sign-in limit is one global bucket (one client can lock everyone out), and raising hops would let a direct client forge `X-Forwarded-For` | Read `app.setup.ts:31-32`, `env.schema.ts:38`, `ThrottlerGuard` as global `APP_GUARD`; nginx forwards a client-supplied `X-Forwarded-For` with its peer appended (seen in the script's stub output) | `TRUST_PROXY_HOPS` is `1` for the `app` profile (override: `API_TRUST_PROXY_HOPS`; named differently because compose also reads `backend/.env`, whose `TRUST_PROXY_HOPS=0` would silently win), `api` published on `127.0.0.1` only, comments say to add one hop per extra proxy |
| 10 | 80% coverage was claimed as enforced (constitution III, README, AI.md) but CI ran plain `vitest run` | Read `ci.yml` against `vite.config.ts` | CI runs `npm run test:cov -w frontend` |
| 11 | Stale or wrong artifacts: tasks/contract said inputs are `disabled` (code: read-only), plan listed `useAuthActions` and a missing `tsconfig.node.json`, quickstart said "nothing is implemented", spec status "Draft", a task cited a test file that does not exist, contract-mirror path comment | Read both sides for each | Artifacts corrected |

## Accepted, not fixed (with reasons)
- **Client `z.email()` accepts addresses the backend's `IsEmail` rejects** (64+ char local part or domain label).
  The server stays authoritative; finding 1's fix makes the rejection visible on the field. Re-implementing
  validator.js in the client would add code for an edge case and risk new drift.
- **`CORS_ORIGIN` defaults to `http://localhost:5173` in compose even though `web` serves on 8080.** It fails closed
  (403, never an allow), the compose comment and README give the exact override, and changing the default would break
  the README's `curl` examples that use the dev origin with the API on 3000.
- **Floating image tags and action tags** (`node:22-alpine`, `nginxinc/nginx-unprivileged:1.30-alpine`,
  `actions/*@v4`) with no digests or image scan. Same convention as the backend image and the original CI spec;
  pinning digests needs a bump process (Dependabot) that does not exist yet. Recorded as future work.
- **Constitution wording vs code (resolved by the owner, constitution 1.0.1):** principle V said motion is "limited
  to `transform` and `opacity`" and "48px controls". The code also transitions colour and box-shadow for
  hover/focus/state feedback and the secondary controls (Sign out, Show/Hide, footer links) are 44px, as FR-019
  requires. The owner chose to amend the principle (PATCH): primary controls 48px, secondary 44px, state-feedback
  colour/shadow transitions up to 200ms, keyframe motion stays `transform`/`opacity`. Two transitions above 200ms
  (`body` theme fade 400ms, checklist dot 250ms) were shortened to 200ms and a "motion budget" test enforces it.
- Cosmetic, not exploitable: `GET /api` redirects to `/api/`; `server_name _` accepts any `Host`.

## Verified / refuted
- Contract conformance: paths, methods, bodies, `{user}` envelopes, error envelope with `details`, `X-Request-Id`
  fallback, 204 on logout and the 401 rules all match `contracts/openapi.yaml` (confirmed by reviewer and by the
  contract-mirror test). Password regex and limits are pinned by a test that reads the YAML.
- nginx header inheritance, `try_files` (no traversal, 404 for a missing asset), CSP (nothing blocked, nothing
  inline), `Origin`/`Referer`/`Sec-Fetch-Site` pass-through, Referrer-Policy impact on the backend's Referer
  fallback, no proxy cache for `/auth/me`, 413 behaviour, non-root user and healthcheck: no defect.
- Client code: no `dangerouslySetInnerHTML`, web storage or `console.*`; `safeReturnPath` rejects `//` and `/\`, and
  `from` only comes from the app's own router state. The session cancel/set logic and the double-submit guard: no
  race found.
- Process: no `*.pdf`, `.env`, or backend source change in the branch diff. `docs/postman/` was staged by a broad
  `git add` on the original branch; the branch under review (`feat/frontend-auth-clean`) was rebuilt from
  `origin/main` and no commit in it touches that path.

## After the fixes
Frontend: 271 tests in 27 files; lint, strict typecheck, build and `verify-image.sh` pass; CI now enforces the 80%
line threshold.
