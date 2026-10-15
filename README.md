# Easygenerator full stack assessment

Sign up / sign in module: a NestJS + MongoDB backend (this repository's first phase) with cookie-based sessions,
fail-closed CSRF protection and a hand-written OpenAPI contract. The React + TypeScript frontend is the next phase
and is not in this branch yet.

## Repository layout

```
backend/     NestJS + MongoDB API
frontend/    React + TypeScript (later phase)
contracts/   openapi.yaml - the API source of truth
docs/        system design, ADRs, design spec, implementation plan, AI-LOG
.claude/     commands and skills used for AI-assisted development
```

Start with [`docs/system-design.md`](docs/system-design.md). AI usage is documented in [`AI.md`](AI.md).

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
- **frontend:** runs only once `frontend/package.json` exists.
- **docker:** builds the backend image (build check only; nothing is pushed).

## Deployment

**Deployment: not configured.** CI builds and verifies only; no deploy job exists. A deploy target and credentials
would have to be set up first.
