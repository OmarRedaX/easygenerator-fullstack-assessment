# Quickstart: validate the frontend auth module

Proves the feature works end to end. Contracts: `contracts/api-usage.md`, `contracts/routes.md`; data shapes:
`data-model.md`. Nothing here is implemented yet; this is the acceptance run for `/speckit-implement`.

## Prerequisites

- Node >= 22.22.2, npm 10+, Docker (for MongoDB), a modern browser.
- Backend merged on `main` (it is). No backend change is needed.

## 1. Start the backend

```bash
docker compose -f backend/docker-compose.yml up -d mongo      # MONGO_PORT=27018 if 27017 is taken
cp backend/.env.example backend/.env                          # then set SESSION_SECRET (openssl rand -base64 32)
npm ci
npm run start:dev -w backend                                  # http://localhost:3000, CORS_ORIGIN=http://localhost:5173
```

## 2. Start the frontend

```bash
npm run dev:frontend                                          # http://localhost:5173 (proxies /api -> :3000)
# If port 3000 is taken: API_PROXY_TARGET=http://localhost:3100 npm run dev:frontend
```

## 3. Manual acceptance scenarios (map to spec.md)

| # | Do | Expect | Spec |
|---|---|---|---|
| 1 | Open `/`, signed out | Redirect to `/signin` | US3-2 |
| 2 | Sign up with `Al` / bad email / `abcdefgh` | Messages appear on blur; checklist shows 8+ chars and a letter only; button submits nothing | US1-3 |
| 3 | Sign up with valid data | Lands on `/`; "Welcome to the application." and your email | US1-1 |
| 4 | Reload `/` | Still signed in | US3-1 |
| 5 | Sign out | On `/signin`; Back button does not show `/` content | US3-4 |
| 6 | Sign up again with the same email | "That email is already registered." on the email field | US1-4 |
| 7 | Sign in with a wrong password, then an unknown email | Same "Invalid email or password." banner both times, with a reference | US2-2 |
| 8 | Open `/signin` while signed in | Redirect to `/` | US3-3 |
| 9 | Stop the backend, submit sign-in | "Something went wrong. Try again.", no reference, values kept | US2-5 |
| 10 | Keyboard only through sign-up | Visible focus ring, logical order, Enter submits | US4-3 |
| 11 | Toggle OS dark mode; enable reduced motion | Dark palette; animations minimal | US4-2, US4-4 |
| 12 | DevTools at 320px and 375px | No horizontal scroll; 48px controls | US4-1 |
| 13 | DevTools Application tab | No session data in local/session storage; cookie `sid` is HttpOnly | FR-017 |

Rate limit (scenario 14, optional): submit sign-in 11 times within a minute -> "Too many attempts. Try again in a
minute."

## 4. Automated checks (same as CI)

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run test:cov -w frontend      # >= 80% lines on src/lib and src/features
npm run build -w frontend
npm audit --audit-level=high --omit=dev
```

Expected: all pass; the test list includes the password boundaries (7/8/128/129), the contract-mirror test, the
error-mapping table, guard redirects, the `cancelQueries` race, every logout outcome, axe checks on all three
pages, and the token contrast test.

## 5. Production image (same-origin through nginx)

```bash
docker build -f frontend/Dockerfile -t eg-frontend:local .
SESSION_SECRET=$(openssl rand -base64 32) CORS_ORIGIN=http://localhost:8080 \
  docker compose -f backend/docker-compose.yml --profile app up --build
# open http://localhost:8080 and repeat scenarios 3-5
curl -sI http://localhost:8080/ | grep -iE 'content-security-policy|x-content-type|x-frame'   # present
curl -s  http://localhost:8080/api/health                                                       # {"status":"ok"}
curl -sI http://localhost:8080/api/health | grep -i content-security-policy                     # backend's own, not the SPA's
```

A sign-up that returns 403 in this setup means `CORS_ORIGIN` does not equal the browser-visible origin or a proxy
dropped `Origin`; see `research.md` R3/R4.
