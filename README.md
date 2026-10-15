# Easygenerator full stack assessment

Sign up / sign in module: a NestJS + MongoDB backend with cookie-based sessions, fail-closed CSRF protection and a
hand-written OpenAPI contract, and a React + TypeScript frontend (sign up, sign in, a protected welcome page) that
talks to it through one same-origin `/api` path.

## Repository layout

```
backend/     NestJS + MongoDB API
frontend/    React + TypeScript SPA (Vite, Tailwind CSS), nginx image
contracts/   openapi.yaml - the API source of truth
specs/       spec-kit feature spec, plan, tasks and quickstart for the frontend
docs/        system design, ADRs, design specs, implementation plan, AI-LOG
.claude/     commands and skills used for AI-assisted development
```

Start with [`docs/system-design.md`](docs/system-design.md). AI usage is documented in [`AI.md`](AI.md).

## File architecture

```
.
├── backend/
│   ├── src/
│   │   ├── main.ts                     bootstrap
│   │   ├── app.module.ts               root module
│   │   ├── app.setup.ts                shared app wiring (pipes, filter, guards, middleware)
│   │   ├── config/                     zod-validated environment (env.schema.ts, config.module.ts)
│   │   ├── common/                     cross-cutting pieces
│   │   │   ├── csrf.guard.ts           fail-closed Origin/Referer check
│   │   │   ├── http-exception.filter.ts  single error envelope
│   │   │   ├── request-id.middleware.ts
│   │   │   ├── body-parser-error.middleware.ts
│   │   │   ├── logging.ts, clock.ts, constants.ts, request.types.ts
│   │   │   └── common.module.ts
│   │   ├── docs/swagger.ts             Swagger UI served from contracts/openapi.yaml
│   │   └── modules/
│   │       ├── auth/                   controller, service, DTOs, password policy and hasher (argon2id),
│   │       │                           Mongo session store, session guard, session cookie, throttling
│   │       ├── users/                  schema, repository (E11000-safe), service, errors
│   │       └── health/                 liveness plus MongoDB ping
│   ├── test/                           integration tests (*.int-spec.ts) and helpers (isolated test DB, app factory)
│   ├── scripts/bench-argon2.ts         argon2 timing benchmark
│   ├── Dockerfile, docker-compose.yml  non-root image; Mongo, plus the API under the `app` profile
│   ├── .env.example, .env.test         environment templates
│   ├── jest.config.ts, eslint.config.mjs, tsconfig*.json, nest-cli.json
│   └── CLAUDE.md                       backend rules
├── frontend/
│   ├── src/
│   │   ├── main.tsx, App.tsx           bootstrap, providers, routes
│   │   ├── styles/                     Tailwind v4 design tokens (index.css) and their test mirror
│   │   ├── lib/
│   │   │   ├── api/                    fetch client, typed auth calls, ApiError / NetworkError (no React)
│   │   │   └── validation/             password policy and Zod schemas mirroring the contract (no React)
│   │   ├── features/
│   │   │   ├── auth/                   sign-up and sign-in pages, session query, route guards, logout, error mapping
│   │   │   └── home/                   the welcome page
│   │   ├── components/ui/              Button, Field, PasswordField, PasswordRules, Alert, Splash, Logo, Spinner
│   │   └── test/                       test setup, render helper, axe helper
│   ├── nginx/                          proxy and security-header config for the production image
│   ├── scripts/verify-image.sh         builds the image and checks headers, SPA fallback and the /api proxy
│   ├── Dockerfile                      build context is the repo root, like the backend's
│   ├── vite.config.ts, eslint.config.mjs, tsconfig.json
│   └── CLAUDE.md                       frontend rules
├── contracts/openapi.yaml              API source of truth
├── specs/001-frontend-auth/            spec-kit spec, plan, research, data model, contracts, tasks, quickstart
├── docs/
│   ├── system-design.md
│   ├── adr/                            architecture decision records (0001-0007)
│   ├── superpowers/                    design specs and implementation plan
│   ├── reviews/                        code review reports
│   └── AI-LOG.md                       running log AI.md is assembled from
├── .claude/                            commands and skills for AI-assisted development
├── .specify/                           spec-kit templates, scripts and the frontend constitution
├── .github/workflows/ci.yml            CI pipeline
├── AI.md, CLAUDE.md, README.md
└── package.json                        npm workspaces root
```

Unit tests (`*.spec.ts`) sit next to the code they cover under `backend/src/`; frontend tests (`*.test.ts(x)`)
sit next to the code they cover under `frontend/src/`.

## Prerequisites

- Node.js 22
- Docker (for a local MongoDB)

## Quick start

```bash
docker compose -f backend/docker-compose.yml up -d mongo   # binds 127.0.0.1 only; set MONGO_PORT if 27017 is taken
cp backend/.env.example backend/.env
# edit backend/.env: set SESSION_SECRET to the output of
openssl rand -base64 32
npm ci
npm run start:dev -w backend
```

The API listens on `http://localhost:3000/api`. Swagger UI: `http://localhost:3000/api/docs`.

Environment variables are validated at startup; the app exits with a clear error if any is invalid
(for example a `SESSION_SECRET` that decodes to fewer than 32 bytes, or argon2 parameters below the floor).
See [`backend/.env.example`](backend/.env.example).

To run the API in Docker as well (set `API_PORT` if port 3000 is taken):

```bash
SESSION_SECRET=$(openssl rand -base64 32) docker compose -f backend/docker-compose.yml --profile app up -d --build
```

## Frontend

React 19 + strict TypeScript single-page app: sign up, sign in and a protected welcome page with sign out. Vite,
Tailwind CSS v4 with hand-built components, React Router, React Hook Form + Zod, TanStack Query. Tests use Vitest,
Testing Library and axe-core. It follows an Apple-inspired design system (tokens in
[`frontend/src/styles/index.css`](frontend/src/styles/index.css)) with light and dark themes from the OS setting,
accessibility checks, and reduced-motion / reduced-transparency support. Its spec, plan and tasks are in
[`specs/001-frontend-auth/`](specs/001-frontend-auth/).

### Run it (development)

With the backend from the quick start running:

```bash
npm ci                     # once, from the repo root
npm run dev:frontend       # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:3000`, so the browser only talks to its own origin (the backend
requires same-site hosting). If port 3000 is taken, run the API elsewhere and point the proxy at it:
`API_PROXY_TARGET=http://localhost:3100 npm run dev:frontend`.

`CORS_ORIGIN` in `backend/.env` must equal the origin in the browser's address bar (`http://localhost:5173` in
development): the CSRF guard compares it with the request's `Origin` even though the request goes through a
same-origin proxy. A `403` on sign-up or sign-in means that value is wrong or a proxy dropped `Origin`. For the same
reason port 5173 is fixed (`strictPort`): a silently chosen 5174 would make every request fail.

### Test it

```bash
npm run lint -w frontend
npm run typecheck -w frontend
npm test -w frontend
npm run test:cov -w frontend   # 80% lines enforced on src/lib and src/features
npm run build -w frontend
bash frontend/scripts/verify-image.sh   # builds the production image and checks headers, SPA fallback, /api proxy
```

The manual acceptance run (13 scenarios against the real backend) is in
[`specs/001-frontend-auth/quickstart.md`](specs/001-frontend-auth/quickstart.md).

### Production image

`frontend/Dockerfile` builds the app and serves it with non-root nginx on port 8080. nginx proxies `/api/` to
`BACKEND_URL` (default `http://api:3000`, scheme and host only) without touching the `/api` prefix or the `Origin`
header. SPA responses carry a Content-Security-Policy without `unsafe-inline` plus the usual hardening headers;
`/api` responses keep the backend's own. HSTS is not set here: it belongs to the TLS-terminating layer.

```bash
SESSION_SECRET=$(openssl rand -base64 32) CORS_ORIGIN=http://localhost:8080 \
  docker compose -f backend/docker-compose.yml --profile app up -d --build    # then open http://localhost:8080
```

Set `MONGO_PORT`, `API_PORT` or `WEB_PORT` if a default port is taken. The API can take a while to boot; an nginx
`502` right after start means it is still starting.

## API

| Method and path | Access | Result |
|---|---|---|
| `POST /api/auth/signup` | public | create user and session, `201 { user }` |
| `POST /api/auth/signin` | public | verify credentials, new session, `200 { user }` |
| `POST /api/auth/logout` | session | destroy session, `204` |
| `GET /api/auth/me` | session | protected endpoint, `200 { user }` |
| `GET /api/health` | public | liveness plus MongoDB ping, `200` / `503` |

Rules: email is trimmed and lowercased; name is 3-80 characters after trimming; password is 8-128 characters with
at least one letter, one digit and one special character from the ASCII punctuation set (a space is not special).
Every error uses one envelope: `{ statusCode, error, message, details?, requestId }`.

### curl examples

Unsafe requests must send an `Origin` header equal to `CORS_ORIGIN` (required setting; `.env.example` uses
`http://localhost:5173`); without one (or a matching `Referer`) the API answers `403`. Use a cookie jar to keep the session.

```bash
curl -i -c jar.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","name":"Alice","password":"Passw0rd!"}'

curl -i -b jar.txt http://localhost:3000/api/auth/me

curl -i -b jar.txt -c jar.txt -X POST http://localhost:3000/api/auth/logout \
  -H 'Origin: http://localhost:5173'

curl -i -c jar.txt -X POST http://localhost:3000/api/auth/signin \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Passw0rd!"}'
```

## Testing

```bash
npm run lint
npm run typecheck
npm run lint:api -w backend     # lint contracts/openapi.yaml
npm run test:unit
npm run test:int                # needs a MongoDB server
npm run test:cov                # unit + integration, 80% threshold enforced
```

Integration tests use a real MongoDB. Set `TEST_MONGODB_URI` (or `MONGODB_URI`) to a **server URI without a
database name**, for example `mongodb://127.0.0.1:27017`; the default is that local URL. The harness creates a
unique `auth_test_<12 hex>` database per suite, runs users and sessions in it, and drops only that database
afterwards. It refuses a URI that names a database, and refuses non-local hosts unless `ALLOW_REMOTE_TEST_DB=true`.

## argon2 benchmark

```bash
npm run bench:argon2 -w backend
```

Prints the average hashing time for the configured parameters (OWASP minimum: 19456 KiB, 2 iterations,
parallelism 1). Run it on the deployment target and raise `ARGON2_*` while signin latency stays acceptable.

## Security notes

- **Same-site hosting only.** Frontend and API must share a site (same origin behind a reverse proxy, or sibling
  subdomains). Cross-site hosting is unsupported; see [ADR 0003](docs/adr/0003-same-site-topology-and-origin-check.md).
- **Fail-closed CSRF.** Every unsafe request needs a matching `Origin` (or `Referer`); `Origin: null` and
  `Sec-Fetch-Site: cross-site` are rejected.
- **Absolute 7-day sessions.** Expiry is enforced by the server on every protected request, not by cookie or TTL.
- Signup reveals whether an email is taken (ADR 0005); signin errors are identical for unknown email and wrong password.
- Generate `SESSION_SECRET` with `openssl rand -base64 32`. Behind a proxy set `TRUST_PROXY_HOPS`.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and pushes to `main`:
- **backend:** install, lint, strict typecheck, OpenAPI lint, unit tests, integration tests against a `mongo:7`
  service container, build, `npm audit --audit-level=high --omit=dev`.
- **frontend:** install, lint, strict typecheck, tests, production build.
- **docker:** builds the backend and frontend images (build check only; nothing is pushed). Both build from the
  repository root because the lockfile lives there.

## Deployment

**Deployment: not configured.** CI builds and verifies only; no deploy job exists. A deploy target and credentials
would have to be set up first.
