# Backend Auth Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the NestJS + MongoDB backend (sign up, sign in, logout, protected `/auth/me`, health) inside a new npm-workspaces monorepo, with CI, API contract, tests and the lean AI workflow files.

**Architecture:** NestJS modules (`config`, `users`, `auth`, `health`, `common`) with strict layering (controller → service → repository → Mongoose). Cookie sessions in MongoDB via `express-session` + `connect-mongo`; the session holds only `userId` and `absoluteExpiresAt`, enforced by `SessionGuard`. A global fail-closed CSRF guard, one error envelope, and a hand-written OpenAPI contract served by Swagger UI.

**Tech Stack:** Node 22, TypeScript strict, NestJS 11, Mongoose, express-session, connect-mongo, argon2, class-validator, Zod, nestjs-pino, helmet, @nestjs/throttler, Jest + supertest (real MongoDB), Redocly CLI, GitHub Actions, Docker.

**Spec:** `docs/superpowers/specs/2026-10-15-auth-assessment-design.md` (read it first; section numbers below refer to it).

**Scope:** This plan covers spec phases 1–3 (foundation, backend module, hardening/docs). The frontend (phase 4) gets its own plan after this PR is green. `AI.md` is drafted here and finalised at submission.

## Global Constraints

- Git is initialised at the monorepo root only. Never commit to `main`; never auto-merge a PR. Flow: issue → `feat/...` branch → conventional commits → push → PR with test evidence.
- Creating the GitHub repo, issue and PR are outward-facing: confirm with the user first.
- The task PDF (`Full_Stack_Test_Task.pdf`) must never be committed.
- Node 22 LTS; TypeScript `strict: true` and `noUncheckedIndexedAccess: true`.
- Password: 8–128 chars; ≥1 `[A-Za-z]`, ≥1 `[0-9]`, ≥1 of the explicit special set ``!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~``; a space is NOT special. Name: trimmed 3–80. Email: trimmed, lowercased, max 254.
- argon2id: memory 19456 KiB, time cost 2, parallelism 1 are the floor; env validation rejects lower values.
- `SESSION_SECRET` must decode to ≥ 32 bytes; placeholders rejected.
- Session data is exactly `userId` and `absoluteExpiresAt`; `absoluteExpiresAt` (now + 7 days) is set at session creation and verified on every protected request; `maxAge`/`touchAfter`/TTL are housekeeping only.
- CSRF fails closed on every unsafe method (Origin → Referer → else 403; `Origin: null` rejected; `Sec-Fetch-Site: cross-site` rejected).
- Same-site hosting only. CORS: one origin, `credentials: true`, no wildcard.
- Signin failures return one generic `401 Invalid email or password`.
- Error envelope everywhere: `{ statusCode, error, message, details?, requestId }`; no stack traces to clients.
- Mongoose models are touched only inside repositories. The single exception is `HealthService`, which uses the Mongoose `Connection` solely to ping (no models, no data access). Controllers are HTTP-only. No secrets in code. Never log passwords/cookies.
- Integration tests use a real MongoDB server. The harness parses and validates the server URI (it must not name a database; non-local hosts are refused unless `ALLOW_REMOTE_TEST_DB=true`), generates a unique `auth_test_<12 hex>` database, injects that URI after (and over) any env override, and verifies the name matches before any destructive cleanup. Users and sessions both use that database. Cleanup runs even if initialisation fails.
- No deploy job in CI; README states "Deployment: not configured".

## Review Focus

1. Password of letters + digits + a space only (space is not special) → `400`.
2. Same address signed up twice as `A@X.com` then ` a@x.com ` → second is `409` (normalisation + unique index).
3. Request with neither `Origin` nor `Referer` (plain curl) to signin/signup/logout → `403`.
4. Session cookie replayed after logout, and after `absoluteExpiresAt` passes → `401` (cookie cleared on expiry).
5. Oversized body (> 16 kb) → `413` and malformed JSON → `400`, both in the error envelope; 129-char password → `400` without hashing; whitespace-only name → `400`.

---

## File Structure

```
package.json  package-lock.json  .gitignore  README.md  AI.md  CLAUDE.md
.github/workflows/ci.yml
.claude/commands/{brainstorm,construct-spec,develop,review-code,update-docs}.md
.claude/skills/{auth-session-security,nest-module-conventions,mongo-integration-testing}/SKILL.md
contracts/openapi.yaml
docs/{system-design.md,AI-LOG.md,adr/0001..0006-*.md}
backend/
  package.json tsconfig.json tsconfig.build.json nest-cli.json eslint.config.mjs jest.config.ts (unit + int projects)
  Dockerfile .dockerignore docker-compose.yml .env.example .env.test CLAUDE.md
  scripts/bench-argon2.ts
  src/
    main.ts  app.module.ts  app.setup.ts
    config/{env.schema.ts,config.module.ts}
    common/{clock.ts,request-id.middleware.ts,http-exception.filter.ts,csrf.guard.ts,session.types.ts,constants.ts}
    modules/users/{user.schema.ts,users.repository.ts,users.service.ts,users.module.ts,errors.ts}
    modules/auth/{password-policy.ts,password-hasher.ts,dto/*.ts,auth.service.ts,auth.controller.ts,session.guard.ts,session-store.ts,auth.module.ts}
    modules/health/{health.controller.ts,health.service.ts,health.module.ts}
    docs/swagger.ts
  test/{helpers/*.ts,*.int-spec.ts}
```

Unit specs live beside sources as `*.spec.ts`; integration specs are `backend/test/*.int-spec.ts`.

---

### Task 1: Repository bootstrap (monorepo, Git, GitHub, issue, branch)

**Files:**
- Create: `.gitignore`, `package.json`
- Rename: `Backend/` → `backend/`, `Frontend/` → `frontend/`

**Interfaces:**
- Produces: root npm workspace `backend`; Git remote `origin`; branch `feat/backend-auth` checked out from `origin/main`; scripts `lint|typecheck|test:unit|test:int|test:cov|build` delegating to `-w backend`.

- [ ] **Step 1: Confirm with the user** the GitHub repo name (suggested `easygenerator-fullstack-assessment`) and that it is created **public**. Do not continue without an explicit yes.

- [ ] **Step 2: Rename folders (from a shell whose cwd is the repo root, not inside `Backend/`)**

Run (Git Bash, from `E:/Full Stack Projects/Easy Generator test task`):
```bash
mv Backend backend_tmp && mv backend_tmp backend
mv Frontend frontend_tmp && mv frontend_tmp frontend
ls
```
Expected: `backend  docs  frontend  Full_Stack_Test_Task.pdf`. If Windows refuses because a process holds `Backend/`, restart Claude Code at the repo root and retry.

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
dist/
coverage/
*.log
.env
.env.*
!.env.example
!.env.test
*.pdf
.claude/settings.local.json
graphify-out/
.DS_Store
```

- [ ] **Step 4: Create root `package.json`**

```json
{
  "name": "easygenerator-assessment",
  "private": true,
  "workspaces": ["backend"],
  "engines": { "node": ">=22" },
  "scripts": {
    "lint": "npm run lint -w backend",
    "typecheck": "npm run typecheck -w backend",
    "test:unit": "npm run test:unit -w backend",
    "test:int": "npm run test:int -w backend",
    "test:cov": "npm run test:cov -w backend",
    "build": "npm run build -w backend"
  }
}
```

- [ ] **Step 5: Create the GitHub repo, so `main` gets its first commit from GitHub (no local commit to `main`)**

```bash
gh repo create <confirmed-name> --public --add-readme --description "Easygenerator full stack assessment: NestJS + MongoDB auth backend, React frontend"
git init -b main
git remote add origin https://github.com/<owner>/<confirmed-name>.git
git fetch origin
```
Do not create a local `README.md` yet (it would collide with the remote one); it is edited after checkout.

- [ ] **Step 6: Create the issue and the feature branch**

```bash
gh issue create --title "Backend: auth module (sign up / sign in) with CI and API contract" --body "Implements docs/superpowers/specs/2026-10-15-auth-assessment-design.md phases 1-3."
git checkout -b feat/backend-auth origin/main
git status --short
```
Expected: on `feat/backend-auth`; untracked files only (`docs/`, `backend/`, `frontend/`, `package.json`, `.gitignore`).

- [ ] **Step 7: Verify the PDF is ignored, then commit**

```bash
git check-ignore -v Full_Stack_Test_Task.pdf
git add .gitignore package.json docs
git commit -m "chore: bootstrap monorepo with npm workspaces, spec and plan"
git push -u origin feat/backend-auth
```
Expected: `check-ignore` prints the `*.pdf` rule; push succeeds.

---

### Task 2: AI workflow files (CLAUDE.md, commands, skills, AI log)

**Files:**
- Create: `CLAUDE.md`, `backend/CLAUDE.md`, `.claude/commands/{brainstorm,construct-spec,develop,review-code,update-docs}.md`, `.claude/skills/{auth-session-security,nest-module-conventions,mongo-integration-testing}/SKILL.md`, `docs/AI-LOG.md`

**Interfaces:**
- Produces: binding rules every later task follows; `docs/AI-LOG.md` format `## YYYY-MM-DD <topic>` with bullets **Prompt / AI output / Correction / Decision**.

- [ ] **Step 1: Write root `CLAUDE.md`**

```markdown
# CLAUDE.md — Easygenerator assessment (monorepo)

Binding for every human and agent. Cite sections by name, never by number.
Source of intent: `docs/superpowers/specs/2026-10-15-auth-assessment-design.md`. API truth: `contracts/openapi.yaml`.

## Repo layout
`backend/` NestJS + MongoDB (built first) · `frontend/` React + TS (later) · `docs/` · `contracts/` · `.claude/`.

## Workflow
`/brainstorm` → `/construct-spec` → `/develop` (tests first) → `/review-code` → `/update-docs`.
Backend must be complete and green before any frontend work.

## Git rules
Issue → `feat/...` branch → conventional commits → push → PR to `main` with test evidence.
Never commit to `main`. Never merge a PR automatically. Never commit `*.pdf`, `.env`, secrets.

## AI log duty
After every non-trivial AI-assisted step append an entry to `docs/AI-LOG.md`: the prompt, what the AI produced,
what was corrected, and any decision that differs from the AI's suggestion. `AI.md` is assembled from it.

## Doc placement
Repo-wide docs in `docs/`; the API contract in `contracts/`; backend rules in `backend/CLAUDE.md`.
```

- [ ] **Step 2: Write `backend/CLAUDE.md` and append the spec's security section verbatim**

```bash
cat > backend/CLAUDE.md <<'EOF'
# backend/CLAUDE.md — auth backend rules (binding)

Stack (locked): Node 22, TS strict, NestJS 11, Mongoose, express-session + connect-mongo, argon2, class-validator,
Zod (env only), nestjs-pino, helmet, @nestjs/throttler, Jest + supertest on a real MongoDB.
Forbidden: JWT/Passport for sessions, in-memory Mongo, Mongoose models outside repositories, logging secrets,
adding runtime dependencies without an ADR.

## Layering
controller (HTTP only) → service (rules) → repository (only code that uses Mongoose models). Modules call each other via services.
Infrastructure exception: `HealthService` may use the Mongoose `Connection` for a ping only (no models, no data access).
Anything else that touches Mongoose belongs in a repository.

## Testing
Test first. Unit specs beside sources; integration specs in `test/*.int-spec.ts` against real MongoDB.

EOF
{ echo "## Security rules"; sed -n '/^## 6\. Security/,/^## 7\./p' docs/superpowers/specs/2026-10-15-auth-assessment-design.md | sed '1d;$d'; } >> backend/CLAUDE.md
tail -n 5 backend/CLAUDE.md
```
Expected: the file ends with the spec's CSRF/CORS/hardening text.

- [ ] **Step 3: Write the five commands** — each is a short markdown file with frontmatter `description`, `argument-hint`:

`.claude/commands/brainstorm.md`
```markdown
---
description: Explore intent for a feature one question at a time; write docs/<module>/brainstorm.md. Inline, no code.
argument-hint: <feature>
---
Read CLAUDE.md and the spec. Ask clarifying questions ONE at a time (multiple choice, recommended first). Flag conflicts with the
spec's Security rules before assuming. Write the brief to docs/<module>/brainstorm.md and stop.
```
`.claude/commands/construct-spec.md`
```markdown
---
description: Turn an approved brainstorm into a spec with endpoints, DTOs, errors and test list.
argument-hint: <module>
---
Read docs/<module>/brainstorm.md, the spec and contracts/openapi.yaml. Write docs/<module>/spec.md with: endpoints, request/response
shapes, error cases, and the exact test list (unit + integration). Contract changes go to contracts/openapi.yaml first.
```
`.claude/commands/develop.md`
```markdown
---
description: Implement a spec task test-first (red, green, commit).
argument-hint: <task>
---
For each step: write the failing test, run it and see it fail, write minimal code, run it and see it pass, commit with a
conventional message. Obey CLAUDE.md layering and Security rules. Append an AI-LOG entry for anything corrected.
```
`.claude/commands/review-code.md`
```markdown
---
description: Review the branch with parallel dimension reviewers, then adversarially verify each finding.
argument-hint: [scope]
---
Dispatch reviewers in ONE message: (1) correctness, (2) security vs backend/CLAUDE.md Security rules, (3) contract drift vs
contracts/openapi.yaml. Each reports findings with file:line. Then try to REFUTE each finding; keep only the ones that survive.
Write one review file; fix survivors via /develop.
```
`.claude/commands/update-docs.md`
```markdown
---
description: Sync README, OpenAPI, ADRs and AI-LOG with the code.
argument-hint: [module]
---
Compare code to contracts/openapi.yaml, README run/test instructions, and docs/adr. Fix drift in the docs, never silently in code.
Ensure docs/AI-LOG.md has entries for this change.
```

- [ ] **Step 4: Write the three skills**

`.claude/skills/auth-session-security/SKILL.md`
```markdown
---
name: auth-session-security
description: Rules for sessions, cookies, CSRF and password hashing in this repo. Use when touching auth, session, guard or hashing code.
---
- Session data = `userId` + `absoluteExpiresAt` only. Enforce expiry in SessionGuard on every protected request (destroy, clear cookie, 401).
- Regenerate the session ID on signin/signup. Cookie: httpOnly, SameSite=Lax, Secure in production.
- CSRF guard fails closed: Origin → Referer → 403; reject `Origin: null` and `Sec-Fetch-Site: cross-site`.
- argon2id floor 19456 KiB / 2 / 1. Signin errors are one generic 401. Never log passwords or cookies.
```
`.claude/skills/nest-module-conventions/SKILL.md`
```markdown
---
name: nest-module-conventions
description: Layering, DTO and error-mapping conventions for NestJS modules in this repo.
---
- Controller: HTTP only. Service: rules. Repository: only code that imports Mongoose models; translates E11000 to DuplicateEmailError.
- Sole exception: HealthService pings through the Mongoose Connection (no models, no data access). Controllers never touch infrastructure.
- DTOs use class-validator with the shared password-policy constant. ValidationPipe is whitelist + forbidNonWhitelisted.
- All errors flow through HttpExceptionFilter to the single envelope `{ statusCode, error, message, details?, requestId }`.
```
`.claude/skills/mongo-integration-testing/SKILL.md`
```markdown
---
name: mongo-integration-testing
description: How integration tests run against a real MongoDB here.
---
- The base server URI comes from `TEST_MONGODB_URI` or `MONGODB_URI` and must not name a database. `createTestDatabase()` parses it, generates `auth_test_<12 hex>`, refuses non-local hosts unless `ALLOW_REMOTE_TEST_DB=true`, and `drop()` re-verifies the name before dropping.
- `createTestApp()` forbids overriding `MONGODB_URI`; users and sessions share the generated database. Always clean up in `finally`.
- Build the app with `createTestApp()` (AppModule + configureApp). Override CLOCK to test expiry, never sleep.
- Send an `Origin` header on unsafe requests or the CSRF guard returns 403.
```

- [ ] **Step 5: Seed `docs/AI-LOG.md`** with the design-phase entries from spec section "Seeded log entries (design phase)", one `## 2026-10-15 <topic>` block per bullet using the **Prompt / AI output / Correction / Decision** format.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md backend/CLAUDE.md .claude docs/AI-LOG.md
git commit -m "docs: add lean AI workflow (CLAUDE.md, commands, skills, AI log)"
```

---

### Task 3: Backend scaffold (tooling, strict TS, Jest projects, local Mongo)

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/nest-cli.json`, `backend/eslint.config.mjs`, `backend/jest.config.ts`, `backend/docker-compose.yml`, `backend/.env.example`, `backend/.env.test`, `backend/test/setup-env.ts`, `backend/src/main.ts`, `backend/src/app.module.ts`

**Interfaces:**
- Produces: npm scripts `lint`, `typecheck`, `test:unit`, `test:int`, `test:cov`, `build`, `start:dev`; Jest projects `unit` (`src/**/*.spec.ts`) and `int` (`test/**/*.int-spec.ts`, in band, loads `.env.test` without overriding real env); local Mongo at `mongodb://127.0.0.1:27017`. In tests `MONGODB_URI` is host-only; helpers append a unique database name.

- [ ] **Step 1: Create `backend/package.json` and install**

```json
{
  "name": "backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test:unit": "jest --selectProjects unit",
    "test:int": "jest --selectProjects int --runInBand",
    "test:cov": "jest --coverage --runInBand",
    "lint:api": "redocly lint ../contracts/openapi.yaml",
    "bench:argon2": "ts-node scripts/bench-argon2.ts"
  }
}
```
```bash
npm install -w backend @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/mongoose @nestjs/config @nestjs/throttler @nestjs/swagger mongoose express-session connect-mongo argon2 class-validator class-transformer zod helmet nestjs-pino pino pino-http reflect-metadata rxjs yaml
npm install -D -w backend @nestjs/cli @nestjs/testing typescript ts-node ts-jest jest @types/jest @types/node @types/express @types/express-session supertest @types/supertest dotenv mongodb-connection-string-url eslint @eslint/js typescript-eslint globals @redocly/cli
```

- [ ] **Step 2: Create TS and Nest configs**

`backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false,
    "skipLibCheck": true,
    "sourceMap": true,
    "incremental": true,
    "types": ["node", "jest"]
  },
  "include": ["src", "test", "scripts", "jest.config.ts"]
}
```
`backend/tsconfig.build.json`
```json
{ "extends": "./tsconfig.json", "compilerOptions": { "rootDir": "./src", "types": ["node"] }, "include": ["src"], "exclude": ["**/*.spec.ts"] }
```
`backend/nest-cli.json`
```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src", "compilerOptions": { "tsConfigPath": "tsconfig.build.json", "deleteOutDir": true } }
```

- [ ] **Step 3: Create `backend/eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
);
```

- [ ] **Step 4: Create `backend/jest.config.ts`**

```ts
import type { Config } from 'jest';

const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};

const config: Config = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'int',
      testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-env.ts'],
      testTimeout: 30000,
    },
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts', '!src/**/*.spec.ts'],
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
};
export default config;
```

- [ ] **Step 5: Create env files and test setup**

`backend/test/setup-env.ts`
```ts
import { config } from 'dotenv';
import { join } from 'node:path';

// Does not override variables already set (CI provides MONGODB_URI).
config({ path: join(__dirname, '..', '.env.test') });
```
`backend/.env.test` (test-only values; this secret is a throwaway used only by tests)
```dotenv
NODE_ENV=test
MONGODB_URI=mongodb://127.0.0.1:27017
SESSION_SECRET=Zk3vQ9mT2xR7pL5wN8bC4hJ6yD1fG0sAqE+uV/oXiMk=
CORS_ORIGIN=http://localhost:5173
THROTTLE_LIMIT=10000
AUTH_THROTTLE_LIMIT=10000
LOG_LEVEL=silent
```
`backend/.env.example`
```dotenv
NODE_ENV=development
PORT=3000
# The database name is part of the URI
MONGODB_URI=mongodb://127.0.0.1:27017/easygenerator
# Generate with: openssl rand -base64 32   (must decode to >= 32 bytes)
SESSION_SECRET=
# Exactly one origin: scheme://host[:port], no path, no trailing slash
CORS_ORIGIN=http://localhost:5173
TRUST_PROXY_HOPS=0
# argon2id (OWASP minimum is the floor; benchmark on your host: npm run bench:argon2 -w backend)
ARGON2_MEMORY_KIB=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
THROTTLE_LIMIT=100
AUTH_THROTTLE_LIMIT=10
LOG_LEVEL=info
```

- [ ] **Step 6: Create `backend/docker-compose.yml` (Mongo only for now) and a minimal bootstrap**

```yaml
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 5s
      timeout: 5s
      retries: 10
```
`backend/src/app.module.ts`
```ts
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```
`backend/src/main.ts`
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
void bootstrap();
```

- [ ] **Step 7: Verify tooling**

Run from repo root: `docker compose -f backend/docker-compose.yml up -d mongo` then `npm run lint && npm run typecheck && npm run build && npm run test:unit -- --passWithNoTests`
Expected: every command exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json backend
git commit -m "chore(backend): scaffold NestJS workspace with strict TS, lint and jest projects"
```

---

### Task 4: Environment validation (Zod)

**Files:**
- Create: `backend/src/config/env.schema.ts`, `backend/src/config/config.module.ts`
- Test: `backend/src/config/env.schema.spec.ts`

**Interfaces:**
- Produces: `type Env`, `parseEnv(raw: Record<string, unknown>): Env` (throws `Error` listing every invalid key), `appConfigModule(overrides?: Record<string, unknown>): DynamicModule` (global `ConfigModule`; validates `{ ...process.env, ...overrides }` with `parseEnv` when called, so tests can inject a unique `MONGODB_URI`). Consumers read config with `ConfigService<Env, true>` and `config.get('KEY', { infer: true })`.

- [ ] **Step 1: Write the failing test `env.schema.spec.ts`**

```ts
import { parseEnv } from './env.schema';

const valid = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
  SESSION_SECRET: 'Zk3vQ9mT2xR7pL5wN8bC4hJ6yD1fG0sAqE+uV/oXiMk=',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(valid)).toMatchObject({
      NODE_ENV: 'development', PORT: 3000, SESSION_COOKIE_NAME: 'sid', TRUST_PROXY_HOPS: 0,
      ARGON2_MEMORY_KIB: 19456, ARGON2_TIME_COST: 2, ARGON2_PARALLELISM: 1,
      THROTTLE_LIMIT: 100, AUTH_THROTTLE_LIMIT: 10,
    });
  });

  it.each([
    ['too short', 'c2hvcnQ='],
    ['not base64', 'not base64 at all!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'],
    ['placeholder', Buffer.from('replace-me-with-a-real-secret-value!!').toString('base64')],
    ['low variety', 'A'.repeat(44)],
  ])('rejects SESSION_SECRET: %s', (_label, secret) => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: secret })).toThrow(/SESSION_SECRET/);
  });

  it.each(['http://localhost:5173/', 'http://localhost:5173/app', 'localhost:5173', '*'])(
    'rejects CORS_ORIGIN %s', (origin) => {
      expect(() => parseEnv({ ...valid, CORS_ORIGIN: origin })).toThrow(/CORS_ORIGIN/);
    });

  it.each([
    ['ARGON2_MEMORY_KIB', '19455'], ['ARGON2_TIME_COST', '1'], ['ARGON2_PARALLELISM', '0'],
  ])('rejects %s below the floor', (key, value) => {
    expect(() => parseEnv({ ...valid, [key]: value })).toThrow(new RegExp(key));
  });

  it('requires MONGODB_URI', () => {
    expect(() => parseEnv({ ...valid, MONGODB_URI: '' })).toThrow(/MONGODB_URI/);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:unit -w backend -- env.schema` → FAIL "Cannot find module './env.schema'".

- [ ] **Step 3: Implement `env.schema.ts` and `config.module.ts`**

```ts
import { z } from 'zod';

const PLACEHOLDER_FRAGMENTS = ['changeme', 'change-me', 'replace', 'secret', 'example', 'placeholder', 'your_', 'your-'];
export const SESSION_SECRET_MIN_BYTES = 32;

const sessionSecret = z.string().superRefine((value, ctx) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'must be base64 (generate with: openssl rand -base64 32)' });
    return;
  }
  if (Buffer.from(value, 'base64').length < SESSION_SECRET_MIN_BYTES) {
    ctx.addIssue({ code: 'custom', message: `must decode to at least ${SESSION_SECRET_MIN_BYTES} bytes` });
  }
  const lower = value.toLowerCase();
  if (PLACEHOLDER_FRAGMENTS.some((p) => lower.includes(p)) || new Set(value).size < 16) {
    ctx.addIssue({ code: 'custom', message: 'looks like a placeholder or low-entropy value; generate a random one' });
  }
});

const corsOrigin = z.string().refine((v) => {
  try {
    return new URL(v).origin === v;
  } catch {
    return false;
  }
}, 'must be exactly one origin like http://localhost:5173 (no path, no trailing slash, no wildcard)');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\/.+/, 'must be a mongodb:// or mongodb+srv:// URI'),
  SESSION_SECRET: sessionSecret,
  SESSION_COOKIE_NAME: z.string().min(1).default('sid'),
  CORS_ORIGIN: corsOrigin,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().min(1).default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
```
`config.module.ts`
```ts
import { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnv } from './env.schema';

/** Called from AppModule.register(); validation runs at call time, never at import time. */
export const appConfigModule = (overrides: Record<string, unknown> = {}): DynamicModule =>
  ConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    envFilePath: '.env',
    validate: (raw) => parseEnv({ ...raw, ...overrides }),
  });
```

- [ ] **Step 4: Run to verify it passes** — `npm run test:unit -w backend -- env.schema` → PASS (all cases).

- [ ] **Step 5: Commit** — `git add backend/src/config && git commit -m "feat(backend): validate environment with zod incl. secret and argon2 floors"`

---

### Task 5: Password policy and hasher

**Files:**
- Create: `backend/src/modules/auth/password-policy.ts`, `backend/src/modules/auth/password-hasher.ts`
- Test: `backend/src/modules/auth/password-policy.spec.ts`, `backend/src/modules/auth/password-hasher.spec.ts`

**Interfaces:**
- Consumes: `Env` from Task 4.
- Produces:
  - `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 128`, `LETTER_RE`, `DIGIT_RE`, `SPECIAL_RE`, `PASSWORD_MESSAGES`, `validatePassword(password: string): string[]` (empty array = valid).
  - `PasswordHasher` (`@Injectable`): `hash(password): Promise<string>`, `verify(hash: string, password: string): Promise<boolean>` (never throws; malformed hash → `false`), `verifyDummy(password: string): Promise<void>`.

- [ ] **Step 1: Write the failing policy test `password-policy.spec.ts`**

```ts
import { validatePassword } from './password-policy';

describe('validatePassword', () => {
  it('accepts a minimal valid password', () => expect(validatePassword('abcdef1!')).toEqual([]));
  it('accepts 128 chars and rejects 129', () => {
    expect(validatePassword('a1!' + 'x'.repeat(125))).toEqual([]);
    expect(validatePassword('a1!' + 'x'.repeat(126))).toHaveLength(1);
  });
  it('rejects 7 chars and accepts 8', () => {
    expect(validatePassword('abcde1!')).toHaveLength(1);
    expect(validatePassword('abcdef1!')).toEqual([]);
  });
  it.each([
    ['no letter', '12345678!'],
    ['no digit', 'abcdefgh!'],
    ['no special', 'abcdefg12'],
  ])('rejects %s', (_l, pw) => expect(validatePassword(pw)).toHaveLength(1));
  it('does not count a space as special', () => expect(validatePassword('abc def 12')).toHaveLength(1));
  it('does not count unicode letters or digits as classes', () => {
    expect(validatePassword('éééééé١٢!')).toHaveLength(2);
  });
  it.each([...'!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'])('counts %s as special', (c) => {
    expect(validatePassword(`abcdef1${c}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:unit -w backend -- password-policy` → FAIL (module missing).

- [ ] **Step 3: Implement `password-policy.ts`**

```ts
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const LETTER_RE = /[A-Za-z]/;
export const DIGIT_RE = /[0-9]/;
// ASCII punctuation/symbols: 0x21-0x2F, 0x3A-0x40, 0x5B-0x60, 0x7B-0x7E. A space is NOT special.
export const SPECIAL_RE = /[!-/:-@[-`{-~]/;

export const PASSWORD_MESSAGES = {
  length: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
  letter: 'Password must contain at least one letter',
  digit: 'Password must contain at least one number',
  special: 'Password must contain at least one special character',
} as const;

export function validatePassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) problems.push(PASSWORD_MESSAGES.length);
  if (!LETTER_RE.test(password)) problems.push(PASSWORD_MESSAGES.letter);
  if (!DIGIT_RE.test(password)) problems.push(PASSWORD_MESSAGES.digit);
  if (!SPECIAL_RE.test(password)) problems.push(PASSWORD_MESSAGES.special);
  return problems;
}
```

- [ ] **Step 4: Run to verify it passes** — `npm run test:unit -w backend -- password-policy` → PASS.

- [ ] **Step 5: Write the failing hasher test `password-hasher.spec.ts`**

```ts
import { ConfigService } from '@nestjs/config';
import { PasswordHasher } from './password-hasher';
import type { Env } from '../../config/env.schema';

const values = { ARGON2_MEMORY_KIB: 19456, ARGON2_TIME_COST: 2, ARGON2_PARALLELISM: 1 };
const config = { get: (key: keyof typeof values) => values[key] } as unknown as ConfigService<Env, true>;

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher(config);

  it('produces an argon2id hash with the configured parameters', async () => {
    expect(await hasher.hash('Passw0rd!')).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });
  it('salts: the same password hashes differently', async () => {
    expect(await hasher.hash('Passw0rd!')).not.toEqual(await hasher.hash('Passw0rd!'));
  });
  it('verifies correct and rejects wrong passwords', async () => {
    const h = await hasher.hash('Passw0rd!');
    expect(await hasher.verify(h, 'Passw0rd!')).toBe(true);
    expect(await hasher.verify(h, 'Passw0rd?')).toBe(false);
  });
  it('returns false (not throws) for a malformed hash', async () => {
    expect(await hasher.verify('not-a-hash', 'x')).toBe(false);
  });
  it('verifyDummy resolves without throwing', async () => {
    await expect(hasher.verifyDummy('anything')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 6: Run to verify it fails** — `npm run test:unit -w backend -- password-hasher` → FAIL.

- [ ] **Step 7: Implement `password-hasher.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import type { Env } from '../../config/env.schema';

@Injectable()
export class PasswordHasher {
  private readonly options: argon2.Options;
  private dummyHash?: Promise<string>;

  constructor(config: ConfigService<Env, true>) {
    this.options = {
      type: argon2.argon2id,
      memoryCost: config.get('ARGON2_MEMORY_KIB', { infer: true }),
      timeCost: config.get('ARGON2_TIME_COST', { infer: true }),
      parallelism: config.get('ARGON2_PARALLELISM', { infer: true }),
    };
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Burns a verification so unknown-email signins cost about the same as wrong-password ones (narrows, does not equalise, timing). */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash('dummy-password-for-timing', this.options);
    await this.verify(await this.dummyHash, password);
  }
}
```

- [ ] **Step 8: Run both specs** — `npm run test:unit -w backend -- password` → PASS.

- [ ] **Step 9: Commit** — `git add backend/src/modules/auth && git commit -m "feat(backend): add password policy and argon2id hasher"`

---

### Task 6: Users module (schema, repository, service)

**Files:**
- Create: `backend/src/modules/users/{errors.ts,user.schema.ts,users.repository.ts,users.service.ts,users.module.ts}`, `backend/test/helpers/db.ts`
- Test: `backend/test/test-database.int-spec.ts`, `backend/test/users.repository.int-spec.ts`

**Interfaces:**
- Produces:
  - `DuplicateEmailError extends Error`.
  - `interface UserRecord { id: string; email: string; name: string; createdAt: Date; passwordHash?: string }`; `interface PublicUser { id: string; email: string; name: string; createdAt: string }`.
  - `UsersRepository`: `create(input: { email: string; name: string; passwordHash: string }): Promise<UserRecord>` (throws `DuplicateEmailError`; result has no hash), `findByEmailWithHash(email: string): Promise<UserRecord | null>` (includes `passwordHash`), `findById(id: string): Promise<UserRecord | null>` (never the hash; malformed id → `null`).
  - `UsersService`: the same three methods delegated, plus `toPublic(user: UserRecord): PublicUser`.
  - Test database harness (`backend/test/helpers/db.ts`):
    - `TEST_DB_PREFIX = 'auth_test_'`; `assertTestDatabaseName(name: string): void` (throws unless the name matches `^auth_test_[0-9a-f]{12}$`).
    - `buildTestDatabaseUri(baseUri: string, dbName: string, opts: { allowRemote: boolean }): string` — parses with `mongodb-connection-string-url`; rejects invalid strings, non-`mongodb`/`mongodb+srv` schemes, a base URI that already names a database, and non-local hosts unless `allowRemote`; preserves credentials, all hosts and options; sets only the database.
    - `createTestDatabase(env?: NodeJS.ProcessEnv): TestDatabase` where `TestDatabase { readonly name: string; readonly uri: string; drop(): Promise<void> }`. Base URI = `env.TEST_MONGODB_URI ?? env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'`. `drop()` is idempotent, re-checks the name, connects, verifies `connection.db.databaseName === name`, drops, and always closes the connection.

- [ ] **Step 1: Write the failing harness test `backend/test/test-database.int-spec.ts`**

```ts
import { ConnectionString } from 'mongodb-connection-string-url';
import mongoose from 'mongoose';
import { assertTestDatabaseName, buildTestDatabaseUri, createTestDatabase } from './helpers/db';

const NAME = 'auth_test_0123456789ab';
const NAME_PATTERN = /^auth_test_[0-9a-f]{12}$/;

describe('test database harness', () => {
  describe('buildTestDatabaseUri', () => {
    it('replaces only the database, preserving credentials, hosts and options', () => {
      const uri = buildTestDatabaseUri(
        'mongodb://user:p%40ss@127.0.0.1:27017,localhost:27018/?replicaSet=rs0&authSource=admin',
        NAME,
        { allowRemote: false },
      );
      const cs = new ConnectionString(uri);
      expect(cs.pathname).toBe(`/${NAME}`);
      expect(cs.hosts).toEqual(['127.0.0.1:27017', 'localhost:27018']);
      expect(cs.username).toBe('user');
      expect(cs.password).toBe('p%40ss');
      expect(cs.searchParams.get('replicaSet')).toBe('rs0');
      expect(cs.searchParams.get('authSource')).toBe('admin');
    });

    it.each([
      ['a URI that already names a database', 'mongodb://127.0.0.1:27017/easygenerator', /must not name a database/],
      ['a non-mongodb scheme', 'http://127.0.0.1:27017', /valid mongodb/],
      ['garbage', 'not a uri', /valid mongodb/],
      ['an empty string', '', /valid mongodb/],
    ])('rejects %s', (_label, base, message) => {
      expect(() => buildTestDatabaseUri(base, NAME, { allowRemote: false })).toThrow(message);
    });

    it.each(['mongodb://db.example.com:27017', 'mongodb://127.0.0.1:27017,db.example.com:27017', 'mongodb+srv://cluster0.example.mongodb.net'])(
      'refuses non-local host %s unless explicitly allowed',
      (base) => {
        expect(() => buildTestDatabaseUri(base, NAME, { allowRemote: false })).toThrow(/non-local/);
        expect(() => buildTestDatabaseUri(base, NAME, { allowRemote: true })).not.toThrow();
      },
    );

    it.each(['mongodb://localhost:27017', 'mongodb://127.0.0.1:27017', 'mongodb://[::1]:27017'])('accepts local host %s', (base) => {
      expect(new ConnectionString(buildTestDatabaseUri(base, NAME, { allowRemote: false })).pathname).toBe(`/${NAME}`);
    });

    it('refuses a database name that is not a generated test name', () => {
      expect(() => buildTestDatabaseUri('mongodb://127.0.0.1:27017', 'easygenerator', { allowRemote: false })).toThrow(/test databases must match/);
    });
  });

  describe('assertTestDatabaseName', () => {
    it.each(['admin', 'local', 'config', 'test', 'easygenerator', 'auth_test_', 'auth_test_xyz', 'AUTH_TEST_0123456789ab', 'auth_test_0123456789abc', 'auth_test_0123456789ab;x', ''])(
      'rejects %j',
      (name) => expect(() => assertTestDatabaseName(name)).toThrow(),
    );
    it('accepts a generated name', () => expect(() => assertTestDatabaseName(NAME)).not.toThrow());
  });

  describe('createTestDatabase', () => {
    const local = { MONGODB_URI: 'mongodb://127.0.0.1:27017' };

    it('generates unique auth_test_ databases', () => {
      const a = createTestDatabase(local);
      const b = createTestDatabase(local);
      expect(a.name).toMatch(NAME_PATTERN);
      expect(b.name).toMatch(NAME_PATTERN);
      expect(a.name).not.toBe(b.name);
      expect(a.uri).toContain(`/${a.name}`);
    });

    it('prefers TEST_MONGODB_URI over MONGODB_URI', () => {
      const db = createTestDatabase({ TEST_MONGODB_URI: 'mongodb://localhost:27099', MONGODB_URI: 'mongodb://127.0.0.1:27017' });
      expect(new ConnectionString(db.uri).hosts).toEqual(['localhost:27099']);
    });

    it('fails fast when the configured URI names a (possibly real) database', () => {
      expect(() => createTestDatabase({ MONGODB_URI: 'mongodb://127.0.0.1:27017/easygenerator' })).toThrow(/must not name a database/);
    });

    it('honours ALLOW_REMOTE_TEST_DB only when exactly "true"', () => {
      const remote = { MONGODB_URI: 'mongodb://db.example.com:27017' };
      expect(() => createTestDatabase(remote)).toThrow(/non-local/);
      expect(() => createTestDatabase({ ...remote, ALLOW_REMOTE_TEST_DB: '1' })).toThrow(/non-local/);
      expect(() => createTestDatabase({ ...remote, ALLOW_REMOTE_TEST_DB: 'true' })).not.toThrow();
    });

    it('drops only its own database, and drop() is idempotent (real MongoDB)', async () => {
      const db = createTestDatabase();
      const conn = await mongoose.createConnection(db.uri).asPromise();
      try {
        await conn.collection('probe').insertOne({ ok: true });
        const names = async () => (await conn.getClient().db().admin().listDatabases()).databases.map((d) => d.name);
        expect(await names()).toContain(db.name);
        await db.drop();
        expect(await names()).not.toContain(db.name);
        await expect(db.drop()).resolves.toBeUndefined();
      } finally {
        await conn.close();
      }
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:int -w backend -- test-database` → FAIL (`./helpers/db` does not exist yet).

- [ ] **Step 3: Implement `backend/test/helpers/db.ts`**

```ts
import { randomBytes } from 'node:crypto';
import { ConnectionString } from 'mongodb-connection-string-url';
import mongoose from 'mongoose';

export const TEST_DB_PREFIX = 'auth_test_';
const TEST_DB_NAME = /^auth_test_[0-9a-f]{12}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface TestDatabase {
  readonly name: string;
  readonly uri: string;
  /** Drops only this generated database. Idempotent; refuses anything that is not auth_test_<12 hex>. */
  drop(): Promise<void>;
}

export function assertTestDatabaseName(name: string): void {
  if (!TEST_DB_NAME.test(name)) {
    throw new Error(`Refusing to use database "${name}": test databases must match ${TEST_DB_NAME}`);
  }
}

const hostnameOf = (hostAndPort: string): string =>
  hostAndPort.startsWith('[') ? hostAndPort.slice(0, hostAndPort.indexOf(']') + 1) : (hostAndPort.split(':')[0] ?? hostAndPort);

/** Parses the server URI and returns it with only the database replaced by `dbName`. */
export function buildTestDatabaseUri(baseUri: string, dbName: string, opts: { allowRemote: boolean }): string {
  assertTestDatabaseName(dbName);

  let cs: ConnectionString;
  try {
    cs = new ConnectionString(baseUri);
  } catch {
    throw new Error('Test MongoDB URI is not a valid mongodb:// or mongodb+srv:// connection string');
  }

  const named = cs.pathname.replace(/^\/+/, '');
  if (named !== '') {
    throw new Error(
      `Test MongoDB URI must not name a database (found "${named}"); the harness generates ${TEST_DB_PREFIX}* itself. ` +
        'Point TEST_MONGODB_URI (or MONGODB_URI) at the server only, e.g. mongodb://127.0.0.1:27017',
    );
  }

  const remote = cs.hosts.map(hostnameOf).filter((h) => !LOCAL_HOSTS.has(h));
  if (remote.length > 0 && !opts.allowRemote) {
    throw new Error(`Refusing destructive tests against non-local host(s): ${remote.join(', ')}. Set ALLOW_REMOTE_TEST_DB=true to allow.`);
  }

  cs.pathname = `/${dbName}`;
  return cs.toString();
}

export function createTestDatabase(env: NodeJS.ProcessEnv = process.env): TestDatabase {
  const baseUri = env.TEST_MONGODB_URI ?? env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
  const name = `${TEST_DB_PREFIX}${randomBytes(6).toString('hex')}`;
  const uri = buildTestDatabaseUri(baseUri, name, { allowRemote: env.ALLOW_REMOTE_TEST_DB === 'true' });
  let dropped = false;

  return {
    name,
    uri,
    async drop(): Promise<void> {
      if (dropped) return;
      assertTestDatabaseName(name);
      const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
      try {
        const actual = conn.db?.databaseName;
        if (actual !== name) {
          throw new Error(`Connected to database "${actual}" but expected "${name}"; refusing to drop`);
        }
        await conn.dropDatabase();
        dropped = true;
      } finally {
        await conn.close();
      }
    },
  };
}
```
If `cs.pathname = ...` does not take effect with the installed `mongodb-connection-string-url` version, the Step 1 test fails on `cs.pathname`; build the URI by replacing the path segment on `cs.toString()` instead and keep the same assertions.

- [ ] **Step 4: Run to verify it passes** — `docker compose -f backend/docker-compose.yml up -d mongo` then `npm run test:int -w backend -- test-database` → PASS.

- [ ] **Step 5: Write the failing repository test `backend/test/users.repository.int-spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersRepository } from '../src/modules/users/users.repository';
import { DuplicateEmailError } from '../src/modules/users/errors';
import { createTestDatabase } from './helpers/db';

describe('UsersRepository (real MongoDB)', () => {
  const db = createTestDatabase(); // throws a clear error before anything runs if the base URI is unsafe
  let repo: UsersRepository;
  let close: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [MongooseModule.forRoot(db.uri), UsersModule] }).compile();
    close = () => mod.close(); // registered before init so a failed init still gets closed
    await mod.init();
    repo = mod.get(UsersRepository);
  });
  afterAll(async () => {
    try {
      await close?.();
    } finally {
      await db.drop(); // runs even if init or close failed
    }
  });

  it('creates a user without returning the hash', async () => {
    const u = await repo.create({ email: 'a@x.com', name: 'Alice', passwordHash: 'h' });
    expect(u).toMatchObject({ email: 'a@x.com', name: 'Alice' });
    expect(u.passwordHash).toBeUndefined();
  });

  it('treats differently-cased/padded emails as duplicates', async () => {
    await repo.create({ email: 'dup@x.com', name: 'Dup', passwordHash: 'h' });
    await expect(repo.create({ email: ' DUP@x.com ', name: 'Dup2', passwordHash: 'h' })).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it('allows exactly one winner under concurrent duplicate signups', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => repo.create({ email: 'race@x.com', name: 'Racer', passwordHash: 'h' })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(5);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(DuplicateEmailError));
  });

  it('findByEmailWithHash returns the hash; findById does not', async () => {
    const created = await repo.create({ email: 'h@x.com', name: 'Hashy', passwordHash: 'secret-hash' });
    expect((await repo.findByEmailWithHash('H@x.com'))?.passwordHash).toBe('secret-hash');
    expect((await repo.findById(created.id))?.passwordHash).toBeUndefined();
  });

  it('returns null for unknown and malformed ids', async () => {
    expect(await repo.findById('not-an-object-id')).toBeNull();
    expect(await repo.findById('64b7f0c2a1b2c3d4e5f60718')).toBeNull();
    expect(await repo.findByEmailWithHash('nobody@x.com')).toBeNull();
  });
});
```

- [ ] **Step 6: Run to verify it fails** — `npm run test:int -w backend -- users.repository` → FAIL (modules missing).

- [ ] **Step 7: Implement the module**

`errors.ts`
```ts
export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'DuplicateEmailError';
  }
}
```
`user.schema.ts`
```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 254 })
  email!: string;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 80 })
  name!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
```
`users.repository.ts`
```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User } from './user.schema';
import { DuplicateEmailError } from './errors';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  passwordHash?: string;
}

type Row = { _id: unknown; email: string; name: string; createdAt: Date; passwordHash?: string };

const toRecord = (row: Row, withHash = false): UserRecord => ({
  id: String(row._id),
  email: row.email,
  name: row.name,
  createdAt: row.createdAt,
  ...(withHash && row.passwordHash !== undefined ? { passwordHash: row.passwordHash } : {}),
});

@Injectable()
export class UsersRepository implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  /** Ensures the unique email index exists before serving traffic (the real duplicate guard). */
  async onModuleInit(): Promise<void> {
    await this.model.init();
  }

  async create(input: { email: string; name: string; passwordHash: string }): Promise<UserRecord> {
    try {
      const doc = await this.model.create(input);
      return toRecord(doc.toObject() as unknown as Row);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
      throw err;
    }
  }

  async findByEmailWithHash(email: string): Promise<UserRecord | null> {
    const row = await this.model.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash').lean<Row>();
    return row ? toRecord(row, true) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!isValidObjectId(id)) return null;
    const row = await this.model.findById(id).lean<Row>();
    return row ? toRecord(row) : null;
  }
}
```
`users.service.ts`
```ts
import { Injectable } from '@nestjs/common';
import { UserRecord, UsersRepository } from './users.repository';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  create(input: { email: string; name: string; passwordHash: string }): Promise<UserRecord> {
    return this.repo.create(input);
  }
  findByEmailWithHash(email: string): Promise<UserRecord | null> {
    return this.repo.findByEmailWithHash(email);
  }
  findById(id: string): Promise<UserRecord | null> {
    return this.repo.findById(id);
  }
  toPublic(user: UserRecord): PublicUser {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
  }
}
```
`users.module.ts`
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UsersRepository, UsersService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
```

- [ ] **Step 8: Run to verify it passes** — `npm run test:int -w backend -- users.repository` → PASS (5 tests). Then `npm run typecheck && npm run lint`.

- [ ] **Step 9: Commit** — `git add backend && git commit -m "feat(backend): add users module with E11000-safe repository and isolated test database harness"`

---

### Task 7: Common infrastructure (clock, request ID, error envelope)

**Files:**
- Create: `backend/src/common/{constants.ts,clock.ts,request.types.ts,request-id.middleware.ts,http-exception.filter.ts,common.module.ts}`
- Test: `backend/src/common/request-id.middleware.spec.ts`, `backend/src/common/http-exception.filter.spec.ts`

**Interfaces:**
- Consumes: `DuplicateEmailError` (Task 6).
- Produces:
  - `SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000`.
  - `CLOCK` (injection token `Symbol('CLOCK')`), `interface Clock { now(): number }`, `systemClock`.
  - `Request.requestId: string` (type augmentation, imported via `'./request.types'`).
  - `requestIdMiddleware(req, res, next)` — accepts a client `X-Request-Id` only if it matches `^[A-Za-z0-9._-]{8,64}$`, otherwise generates a UUID; echoes it in the `X-Request-Id` response header.
  - `HttpExceptionFilter` (`@Catch()`): every error → `{ statusCode, error, message, details?, requestId }`.
  - `CommonModule` (`@Global`) providing `CLOCK`.

- [ ] **Step 1: Create the small pure files**

`constants.ts`
```ts
export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
```
`clock.ts`
```ts
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
```
`request.types.ts`
```ts
declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}
export {};
```
`common.module.ts`
```ts
import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from './clock';

@Global()
@Module({ providers: [{ provide: CLOCK, useValue: systemClock }], exports: [CLOCK] })
export class CommonModule {}
```

- [ ] **Step 2: Write the failing middleware test `request-id.middleware.spec.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

function run(header?: string) {
  const req = { headers: header === undefined ? {} : { 'x-request-id': header } } as unknown as Request;
  const setHeader = jest.fn();
  const next = jest.fn() as NextFunction;
  requestIdMiddleware(req, { setHeader } as unknown as Response, next);
  return { req, setHeader, next };
}

describe('requestIdMiddleware', () => {
  it('keeps a well-formed client id and echoes it', () => {
    const { req, setHeader, next } = run('abc12345-req');
    expect(req.requestId).toBe('abc12345-req');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc12345-req');
    expect(next).toHaveBeenCalled();
  });
  it.each(['short', 'has spaces in it!', 'x'.repeat(65), 'line\nbreak-injection'])('replaces unsafe id %j', (bad) => {
    const { req } = run(bad);
    expect(req.requestId).not.toBe(bad);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('generates an id when none is sent', () => {
    expect(run().req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npm run test:unit -w backend -- request-id` → FAIL (module missing).

- [ ] **Step 4: Implement `request-id.middleware.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import './request.types';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
```

- [ ] **Step 5: Run to verify it passes** — `npm run test:unit -w backend -- request-id` → PASS.

- [ ] **Step 6: Write the failing filter test `http-exception.filter.spec.ts`**

```ts
import { ArgumentsHost, BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { DuplicateEmailError } from '../modules/users/errors';
import { HttpExceptionFilter } from './http-exception.filter';

function invoke(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: '/api/x', requestId: 'req-1234567' }),
      getResponse: () => ({ status, headersSent: false }),
    }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0] as number, body: json.mock.calls[0]?.[0] as Record<string, unknown> };
}

describe('HttpExceptionFilter', () => {
  it('maps DuplicateEmailError to 409', () => {
    const { status, body } = invoke(new DuplicateEmailError());
    expect(status).toBe(409);
    expect(body).toEqual({ statusCode: 409, error: 'Conflict', message: 'Email already registered', requestId: 'req-1234567' });
  });
  it('keeps validation details', () => {
    const details = [{ field: 'email', messages: ['email must be an email'] }];
    const { status, body } = invoke(new BadRequestException({ message: 'Validation failed', details }));
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'Bad Request', message: 'Validation failed', details });
  });
  it('maps 401 and 403 passthrough', () => {
    expect(invoke(new UnauthorizedException('Invalid email or password')).body).toMatchObject({
      statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password',
    });
  });
  it('normalises throttling to a fixed 429 message', () => {
    const { status, body } = invoke(new HttpException('ThrottlerException: Too Many Requests', 429));
    expect(status).toBe(429);
    expect(body.message).toBe('Too many requests, please try again later');
  });
  it.each([
    ['entity.too.large', 413, 'Request body too large'],
    ['entity.parse.failed', 400, 'Malformed JSON body'],
  ])('maps body-parser error %s', (type, code, message) => {
    const { status, body } = invoke({ type, status: code, expose: true });
    expect(status).toBe(code);
    expect(body.message).toBe(message);
  });
  it('hides internals of unexpected errors', () => {
    const { status, body } = invoke(new Error('connection string mongodb://user:pw@host leaked'));
    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, error: 'Internal Server Error', message: 'Internal server error', requestId: 'req-1234567' });
    expect(JSON.stringify(body)).not.toMatch(/mongodb:|stack/);
  });
});
```

- [ ] **Step 7: Run to verify it fails** — `npm run test:unit -w backend -- http-exception` → FAIL.

- [ ] **Step 8: Implement `http-exception.filter.ts`**

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { DuplicateEmailError } from '../modules/users/errors';
import './request.types';

export interface ErrorDetail {
  field: string;
  messages: string[];
}

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: ErrorDetail[];
  requestId: string;
}

interface Normalized {
  statusCode: number;
  message: string;
  details?: ErrorDetail[];
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.too.large': 'Request body too large',
  'entity.parse.failed': 'Malformed JSON body',
};

function normalize(exception: unknown): Normalized {
  if (exception instanceof DuplicateEmailError) return { statusCode: HttpStatus.CONFLICT, message: exception.message };

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return { statusCode, message: 'Too many requests, please try again later' };
    }
    const body = exception.getResponse();
    if (typeof body === 'string') return { statusCode, message: body };
    const { message, details } = body as { message?: string | string[]; details?: ErrorDetail[] };
    return {
      statusCode,
      message: Array.isArray(message) ? message.join('; ') : (message ?? exception.message),
      ...(details ? { details } : {}),
    };
  }

  // Express/body-parser errors (malformed JSON, payload too large) are not HttpExceptions.
  const http = (exception ?? {}) as { status?: unknown; statusCode?: unknown; type?: unknown; expose?: unknown };
  const status = typeof http.status === 'number' ? http.status : typeof http.statusCode === 'number' ? http.statusCode : undefined;
  if (status !== undefined && status >= 400 && status < 500 && http.expose === true) {
    return { statusCode: status, message: (typeof http.type === 'string' && BODY_PARSER_MESSAGES[http.type]) || 'Bad request' };
  }

  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    if (res.headersSent) return;

    const { statusCode, message, details } = normalize(exception);
    if (statusCode >= 500) {
      this.logger.error(`${req.method} ${req.originalUrl} failed [${req.requestId}]`, exception instanceof Error ? exception.stack : String(exception));
    }
    const body: ErrorBody = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...(details ? { details } : {}),
      requestId: req.requestId,
    };
    res.status(statusCode).json(body);
  }
}
```

- [ ] **Step 9: Run both specs** — `npm run test:unit -w backend -- common` → PASS. Then `npm run typecheck && npm run lint`.

- [ ] **Step 10: Commit** — `git add backend/src/common && git commit -m "feat(backend): add request id middleware and single error envelope filter"`

---

### Task 8: Fail-closed CSRF guard

**Files:**
- Create: `backend/src/common/csrf.guard.ts`
- Test: `backend/src/common/csrf.guard.spec.ts`

**Interfaces:**
- Consumes: `Env` (Task 4) — reads `CORS_ORIGIN`.
- Produces: `CsrfGuard` (`CanActivate`, to be registered as a global `APP_GUARD`): safe methods (GET, HEAD, OPTIONS) pass; every other method needs a matching `Origin`, or else a matching `Referer` origin; otherwise `ForbiddenException('CSRF check failed')`.

- [ ] **Step 1: Write the failing test `csrf.guard.spec.ts`**

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './csrf.guard';
import type { Env } from '../config/env.schema';

const ALLOWED = 'http://localhost:5173';
const config = { get: () => ALLOWED } as unknown as ConfigService<Env, true>;
const guard = new CsrfGuard(config);

const ctx = (method: string, headers: Record<string, string> = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ method, headers }) }) }) as unknown as ExecutionContext;

describe('CsrfGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('lets safe method %s through without headers', (m) => {
    expect(guard.canActivate(ctx(m))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows %s with the matching Origin', (m) => {
    expect(guard.canActivate(ctx(m, { origin: ALLOWED }))).toBe(true);
  });

  it.each([
    ['foreign Origin', { origin: 'https://evil.example' }],
    ['literal null Origin', { origin: 'null' }],
    ['empty Origin', { origin: '' }],
    ['Origin with different port', { origin: 'http://localhost:3000' }],
    ['no Origin, foreign Referer', { referer: 'https://evil.example/page' }],
    ['no Origin, garbage Referer', { referer: 'not a url' }],
    ['no Origin and no Referer', {}],
    ['matching Origin but Sec-Fetch-Site cross-site', { origin: ALLOWED, 'sec-fetch-site': 'cross-site' }],
    ['foreign Origin even with matching Referer', { origin: 'https://evil.example', referer: `${ALLOWED}/x` }],
  ])('rejects POST: %s', (_label, headers) => {
    expect(() => guard.canActivate(ctx('POST', headers))).toThrow(ForbiddenException);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(guard.canActivate(ctx('POST', { referer: `${ALLOWED}/signin?x=1` }))).toBe(true);
  });

  it('accepts same-site Sec-Fetch-Site with matching Origin', () => {
    expect(guard.canActivate(ctx('POST', { origin: ALLOWED, 'sec-fetch-site': 'same-site' }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:unit -w backend -- csrf` → FAIL (module missing).

- [ ] **Step 3: Implement `csrf.guard.ts`**

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../config/env.schema';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Fail-closed CSRF defence for cookie sessions (supported topology: same-site only).
 * Order: Sec-Fetch-Site cross-site -> reject; Origin present -> must equal CORS_ORIGIN;
 * else Referer origin must equal CORS_ORIGIN; else reject. Never silently allows.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigin = config.get('CORS_ORIGIN', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    if (req.headers['sec-fetch-site'] === 'cross-site') return this.deny();

    const origin = req.headers.origin;
    if (origin !== undefined) return origin === this.allowedOrigin ? true : this.deny();

    const referer = req.headers.referer;
    if (typeof referer === 'string') {
      try {
        if (new URL(referer).origin === this.allowedOrigin) return true;
      } catch {
        // unparsable Referer falls through to deny
      }
    }
    return this.deny();
  }

  private deny(): never {
    throw new ForbiddenException('CSRF check failed');
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npm run test:unit -w backend -- csrf` → PASS.

- [ ] **Step 5: Commit** — `git add backend/src/common/csrf.guard* && git commit -m "feat(backend): add fail-closed Origin/Referer CSRF guard"`

---

### Task 9: Session infrastructure (store, helpers, SessionGuard with absolute expiry)

**Files:**
- Create: `backend/src/modules/auth/{session.types.ts,session-cookie.ts,session.util.ts,session-store.ts,session.guard.ts}`
- Test: `backend/src/modules/auth/session.guard.spec.ts`

**Interfaces:**
- Consumes: `CLOCK`/`Clock` and `SESSION_ABSOLUTE_TTL_MS` (Task 7), `Env` (Task 4).
- Produces:
  - Session data type: `{ userId: string; absoluteExpiresAt: number }` (augments `express-session`; nothing else is ever stored).
  - `sessionCookieOptions(nodeEnv: Env['NODE_ENV']): CookieOptions` → `{ httpOnly: true, sameSite: 'lax', secure: nodeEnv === 'production', path: '/' }`.
  - `regenerateSession(req)`, `saveSession(req)`, `destroySession(req)` (all `Promise<void>`); `startAuthenticatedSession(req: Request, userId: string, nowMs: number): Promise<void>` — regenerates the ID, sets `userId` and `absoluteExpiresAt = nowMs + SESSION_ABSOLUTE_TTL_MS`, saves.
  - `SessionStoreService` (`@Injectable`, `readonly store: MongoStore`, closes on module destroy; collection `sessions`, `touchAfter` 24 h, TTL = 7 days — housekeeping only).
  - `SessionGuard` (`CanActivate`): 401 `Authentication required` when `userId`/`absoluteExpiresAt` missing; when `clock.now() >= absoluteExpiresAt` it destroys the session, clears the cookie (same options) and throws 401 `Session expired`.

- [ ] **Step 1: Create the small files**

`session.types.ts`
```ts
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    absoluteExpiresAt: number;
  }
}
```
`session-cookie.ts`
```ts
import type { CookieOptions } from 'express';
import type { Env } from '../../config/env.schema';

export function sessionCookieOptions(nodeEnv: Env['NODE_ENV']): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: nodeEnv === 'production', path: '/' };
}
```
`session.util.ts`
```ts
import type { Request } from 'express';
import { SESSION_ABSOLUTE_TTL_MS } from '../../common/constants';
import './session.types';

const settle = (run: (cb: (err?: unknown) => void) => void): Promise<void> =>
  new Promise((resolve, reject) => run((err) => (err ? reject(err) : resolve())));

export const regenerateSession = (req: Request): Promise<void> => settle((cb) => req.session.regenerate(cb));
export const saveSession = (req: Request): Promise<void> => settle((cb) => req.session.save(cb));
export const destroySession = (req: Request): Promise<void> => settle((cb) => req.session.destroy(cb));

/** New session ID on every authentication (fixation defence); absolute expiry fixed at creation. */
export async function startAuthenticatedSession(req: Request, userId: string, nowMs: number): Promise<void> {
  await regenerateSession(req);
  req.session.userId = userId;
  req.session.absoluteExpiresAt = nowMs + SESSION_ABSOLUTE_TTL_MS;
  await saveSession(req);
}
```
`session-store.ts`
```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MongoStore from 'connect-mongo';
import { SESSION_ABSOLUTE_TTL_MS } from '../../common/constants';
import type { Env } from '../../config/env.schema';

/** TTL index / touchAfter are storage housekeeping only; SessionGuard enforces the real 7-day limit. */
@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  readonly store: MongoStore;

  constructor(config: ConfigService<Env, true>) {
    this.store = MongoStore.create({
      mongoUrl: config.get('MONGODB_URI', { infer: true }),
      collectionName: 'sessions',
      ttl: SESSION_ABSOLUTE_TTL_MS / 1000,
      touchAfter: 24 * 3600,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }
}
```

- [ ] **Step 2: Write the failing guard test `session.guard.spec.ts`**

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionGuard } from './session.guard';
import type { Clock } from '../../common/clock';
import type { Env } from '../../config/env.schema';

const values = { SESSION_COOKIE_NAME: 'sid', NODE_ENV: 'production' };
const config = { get: (k: keyof typeof values) => values[k] } as unknown as ConfigService<Env, true>;

function setup(session: Record<string, unknown>, now: number) {
  const destroy = jest.fn((cb: (e?: unknown) => void) => cb());
  const clearCookie = jest.fn();
  const clock: Clock = { now: () => now };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ session: { ...session, destroy } }),
      getResponse: () => ({ clearCookie }),
    }),
  } as unknown as ExecutionContext;
  return { guard: new SessionGuard(clock, config), ctx, destroy, clearCookie };
}

describe('SessionGuard', () => {
  it('allows a live session', async () => {
    const { guard, ctx } = setup({ userId: 'u1', absoluteExpiresAt: 2000 }, 1000);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it.each([
    ['no session data', {}],
    ['no userId', { absoluteExpiresAt: 2000 }],
    ['no absoluteExpiresAt', { userId: 'u1' }],
    ['non-numeric absoluteExpiresAt', { userId: 'u1', absoluteExpiresAt: '2000' }],
  ])('rejects %s with 401 and does not clear anything', async (_l, session) => {
    const { guard, ctx, destroy, clearCookie } = setup(session, 1000);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(destroy).not.toHaveBeenCalled();
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it.each([1999, 2000, 5000])('expires at/after absoluteExpiresAt (now=%d vs 2000 boundary uses >=)', async (now) => {
    const { guard, ctx, destroy, clearCookie } = setup({ userId: 'u1', absoluteExpiresAt: 2000 }, now);
    if (now < 2000) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      return;
    }
    await expect(guard.canActivate(ctx)).rejects.toThrow('Session expired');
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(clearCookie).toHaveBeenCalledWith('sid', { httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npm run test:unit -w backend -- session.guard` → FAIL (module missing).

- [ ] **Step 4: Implement `session.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CLOCK, Clock } from '../../common/clock';
import type { Env } from '../../config/env.schema';
import { sessionCookieOptions } from './session-cookie';
import { destroySession } from './session.util';
import './session.types';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly cookieName: string;
  private readonly cookieOptions: ReturnType<typeof sessionCookieOptions>;

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService<Env, true>,
  ) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.cookieOptions = sessionCookieOptions(config.get('NODE_ENV', { infer: true }));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { userId, absoluteExpiresAt } = req.session;

    if (!userId || typeof absoluteExpiresAt !== 'number') {
      throw new UnauthorizedException('Authentication required');
    }
    if (this.clock.now() >= absoluteExpiresAt) {
      await destroySession(req);
      http.getResponse<Response>().clearCookie(this.cookieName, this.cookieOptions);
      throw new UnauthorizedException('Session expired');
    }
    return true;
  }
}
```

- [ ] **Step 5: Run to verify it passes** — `npm run test:unit -w backend -- session.guard` → PASS. Then `npm run typecheck`.

- [ ] **Step 6: Commit** — `git add backend/src/modules/auth && git commit -m "feat(backend): add Mongo session store and guard enforcing absolute expiry"`

---

### Task 10: DTOs and AuthService

**Files:**
- Create: `backend/src/modules/auth/dto/{sign-up.dto.ts,sign-in.dto.ts}`, `backend/src/modules/auth/auth.service.ts`
- Test: `backend/src/modules/auth/dto/dto.spec.ts`, `backend/src/modules/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: policy constants (Task 5), `PasswordHasher` (Task 5), `UsersService`/`UserRecord` (Task 6).
- Produces:
  - `SignUpDto { email: string; name: string; password: string }` (email trimmed+lowercased, name trimmed) and `SignInDto { email: string; password: string }`.
  - `AuthService.signUp(dto: SignUpDto): Promise<UserRecord>` (propagates `DuplicateEmailError`); `AuthService.signIn(email: string, password: string): Promise<UserRecord>` — throws `UnauthorizedException('Invalid email or password')` for unknown email (after `verifyDummy`) and for a wrong password.

- [ ] **Step 1: Write the failing DTO test `dto/dto.spec.ts`**

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignInDto } from './sign-in.dto';
import { SignUpDto } from './sign-up.dto';

const fields = async <T extends object>(cls: new () => T, input: object) =>
  (await validate(plainToInstance(cls, input))).map((e) => e.property).sort();

const good = { email: 'a@x.com', name: 'Alice', password: 'abcdef1!' };

describe('SignUpDto', () => {
  it('accepts valid input', async () => expect(await fields(SignUpDto, good)).toEqual([]));

  it('normalises email (trim + lowercase) and trims name', () => {
    const dto = plainToInstance(SignUpDto, { ...good, email: '  A@X.Com ', name: '  Alice  ' });
    expect(dto.email).toBe('a@x.com');
    expect(dto.name).toBe('Alice');
  });

  it.each([['not-an-email'], [''], ['a@'], [`${'a'.repeat(250)}@x.com`]])('rejects email %j', async (email) => {
    expect(await fields(SignUpDto, { ...good, email })).toEqual(['email']);
  });

  it.each([['ab'], ['  ab  '], ['   '], [''], ['x'.repeat(81)]])('rejects name %j', async (name) => {
    expect(await fields(SignUpDto, { ...good, name })).toEqual(['name']);
  });

  it('accepts the minimum 3-character name', async () => {
    expect(await fields(SignUpDto, { ...good, name: 'Bob' })).toEqual([]);
  });

  it.each([
    ['too short', 'abc12!'],
    ['no letter', '12345678!'],
    ['no digit', 'abcdefgh!'],
    ['no special', 'abcdefg12'],
    ['space only as special', 'abc def 12'],
    ['129 chars', 'a1!' + 'x'.repeat(126)],
  ])('rejects password: %s', async (_l, password) => {
    expect(await fields(SignUpDto, { ...good, password })).toEqual(['password']);
  });

  it('rejects non-string fields', async () => {
    expect(await fields(SignUpDto, { email: 1, name: 2, password: 3 })).toEqual(['email', 'name', 'password']);
  });
});

describe('SignInDto', () => {
  it('only checks presence and type of the password (policy not re-applied)', async () => {
    expect(await fields(SignInDto, { email: 'a@x.com', password: 'weak' })).toEqual([]);
    expect(await fields(SignInDto, { email: 'a@x.com', password: '' })).toEqual(['password']);
    expect(await fields(SignInDto, { email: 'bad', password: 'x' })).toEqual(['email']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:unit -w backend -- dto.spec` → FAIL (modules missing).

- [ ] **Step 3: Implement the DTOs**

`dto/sign-up.dto.ts`
```ts
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  DIGIT_RE, LETTER_RE, PASSWORD_MAX_LENGTH, PASSWORD_MESSAGES, PASSWORD_MIN_LENGTH, SPECIAL_RE,
} from '../password-policy';

export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);
export const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SignUpDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  @Transform(trimString)
  @IsString()
  @Length(3, 80, { message: 'name must be between 3 and 80 characters' })
  name!: string;

  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_MESSAGES.length })
  @Matches(LETTER_RE, { message: PASSWORD_MESSAGES.letter })
  @Matches(DIGIT_RE, { message: PASSWORD_MESSAGES.digit })
  @Matches(SPECIAL_RE, { message: PASSWORD_MESSAGES.special })
  password!: string;
}
```
`dto/sign-in.dto.ts`
```ts
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from './sign-up.dto';

export class SignInDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'password must not be empty' })
  password!: string;
}
```

- [ ] **Step 4: Run to verify it passes** — `npm run test:unit -w backend -- dto.spec` → PASS.

- [ ] **Step 5: Write the failing service test `auth.service.spec.ts`**

```ts
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DuplicateEmailError } from '../users/errors';
import type { PasswordHasher } from './password-hasher';
import type { UsersService } from '../users/users.service';

const user = { id: 'u1', email: 'a@x.com', name: 'Alice', createdAt: new Date(0), passwordHash: 'stored-hash' };

function setup() {
  const users = { create: jest.fn(), findByEmailWithHash: jest.fn() };
  const hasher = { hash: jest.fn(), verify: jest.fn(), verifyDummy: jest.fn() };
  const service = new AuthService(users as unknown as UsersService, hasher as unknown as PasswordHasher);
  return { users, hasher, service };
}

describe('AuthService', () => {
  describe('signUp', () => {
    it('stores only the hash, never the plaintext password', async () => {
      const { users, hasher, service } = setup();
      hasher.hash.mockResolvedValue('HASHED');
      users.create.mockResolvedValue({ ...user, passwordHash: undefined });
      await service.signUp({ email: 'a@x.com', name: 'Alice', password: 'abcdef1!' });
      expect(users.create).toHaveBeenCalledWith({ email: 'a@x.com', name: 'Alice', passwordHash: 'HASHED' });
      expect(JSON.stringify(users.create.mock.calls)).not.toContain('abcdef1!');
    });
    it('propagates DuplicateEmailError', async () => {
      const { users, hasher, service } = setup();
      hasher.hash.mockResolvedValue('H');
      users.create.mockRejectedValue(new DuplicateEmailError());
      await expect(service.signUp({ email: 'a@x.com', name: 'Alice', password: 'abcdef1!' })).rejects.toBeInstanceOf(DuplicateEmailError);
    });
  });

  describe('signIn', () => {
    it('returns the user on a correct password', async () => {
      const { users, hasher, service } = setup();
      users.findByEmailWithHash.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);
      await expect(service.signIn('a@x.com', 'pw')).resolves.toBe(user);
      expect(hasher.verify).toHaveBeenCalledWith('stored-hash', 'pw');
    });
    it('wrong password: generic 401', async () => {
      const { users, hasher, service } = setup();
      users.findByEmailWithHash.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);
      await expect(service.signIn('a@x.com', 'bad')).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
    it('unknown email: same generic 401 and a dummy verification is burned', async () => {
      const { users, hasher, service } = setup();
      users.findByEmailWithHash.mockResolvedValue(null);
      await expect(service.signIn('nobody@x.com', 'pw')).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(hasher.verifyDummy).toHaveBeenCalledWith('pw');
      expect(hasher.verify).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run to verify it fails** — `npm run test:unit -w backend -- auth.service` → FAIL.

- [ ] **Step 7: Implement `auth.service.ts`**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRecord } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { PasswordHasher } from './password-hasher';
import { SignUpDto } from './dto/sign-up.dto';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
  ) {}

  async signUp(dto: SignUpDto): Promise<UserRecord> {
    const passwordHash = await this.hasher.hash(dto.password);
    return this.users.create({ email: dto.email, name: dto.name, passwordHash });
  }

  async signIn(email: string, password: string): Promise<UserRecord> {
    const user = await this.users.findByEmailWithHash(email);
    if (!user?.passwordHash) {
      await this.hasher.verifyDummy(password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await this.hasher.verify(user.passwordHash, password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return user;
  }
}
```

- [ ] **Step 8: Run to verify it passes** — `npm run test:unit -w backend` → PASS (whole unit project). Then `npm run typecheck && npm run lint`.

- [ ] **Step 9: Commit** — `git add backend/src/modules/auth && git commit -m "feat(backend): add auth DTOs and service with generic signin failure"`

---

### Task 11: Wire the app (controller, health, AppModule, configureApp) + auth integration suite

**Files:**
- Create: `backend/src/common/logging.ts`, `backend/src/modules/auth/{auth-throttle.ts,auth.controller.ts,auth.module.ts}`, `backend/src/modules/health/{health.service.ts,health.controller.ts,health.module.ts}`, `backend/src/app.setup.ts`, `backend/test/helpers/app.ts`
- Modify: `backend/src/app.module.ts` (rewrite), `backend/src/main.ts` (rewrite)
- Test: `backend/src/common/logging.spec.ts`, `backend/src/modules/health/health.service.spec.ts`, `backend/src/modules/health/health.controller.spec.ts`, `backend/test/test-app.int-spec.ts`, `backend/test/auth.int-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–10.
- Produces:
  - `AppModule.register(overrides?: Record<string, unknown>): DynamicModule` — `overrides` are merged over `process.env` before validation (tests inject `MONGODB_URI`, throttle limits).
  - `configureApp(app: NestExpressApplication): void` — trust proxy, request-id, helmet, CORS (one origin, credentials), session middleware, 16 kb JSON limit, global `ValidationPipe` (whitelist + forbidNonWhitelisted + `{ message: 'Validation failed', details }`), `HttpExceptionFilter`, global prefix `api`, pino logger, shutdown hooks.
  - `AuthThrottled()` decorator (metadata `authThrottled`) selecting the strict named throttler `auth`.
  - `HealthService.isDatabaseUp(): Promise<boolean>` (never throws; the sole sanctioned infrastructure exception to the repository-only Mongoose rule — connection ping, no models, no data access). `HealthController` only maps `false` to `503`.
  - Test helper `createTestApp(env?: Record<string, string>): Promise<TestApp>` with `TestApp { app; clock: MutableClock; dbName: string; agent(): TestAgent; close(): Promise<void> }`, `ORIGIN = 'http://localhost:5173'`, `MutableClock.advance(ms)`. It rejects `MONGODB_URI`/`TEST_MONGODB_URI` in `env`, injects the generated `auth_test_` URI last, and cleans up (app/module close then verified database drop) on both `close()` and a failed initialisation.
  - Public routes: `POST /api/auth/signup` (201 `{ user }`), `POST /api/auth/signin` (200 `{ user }`), `POST /api/auth/logout` (204), `GET /api/auth/me` (200 `{ user }`), `GET /api/health` (200 `{ status: 'ok' }` / 503).

- [ ] **Step 1: Write the failing logging-redaction test `common/logging.spec.ts`**

```ts
import { Writable } from 'node:stream';
import pino from 'pino';
import { REDACT_PATHS } from './logging';

describe('log redaction', () => {
  it('never writes cookies, auth headers or passwords', () => {
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _enc, cb) { lines.push(String(chunk)); cb(); } });
    pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream).info(
      {
        req: { headers: { cookie: 'sid=SECRETCOOKIE', authorization: 'Bearer TOKEN123' }, body: { password: 'hunter2!' } },
        res: { headers: { 'set-cookie': ['sid=SECRETCOOKIE'] } },
        password: 'hunter2!',
        user: { password: 'hunter2!' },
      },
      'request',
    );
    const out = lines.join('');
    expect(out).not.toMatch(/SECRETCOOKIE|TOKEN123|hunter2/);
    expect(out).toContain('[REDACTED]');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:unit -w backend -- logging` → FAIL. Then implement `common/logging.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'req.body.password',
  'password',
  '*.password',
];

export function buildPinoHttpOptions(level: string): Options {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    genReqId: (req: IncomingMessage) => (req as IncomingMessage & { requestId?: string }).requestId ?? randomUUID(),
    autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
  };
}
```
Re-run: `npm run test:unit -w backend -- logging` → PASS.

- [ ] **Step 3: Health: service (infrastructure) + HTTP-only controller, test first**

Write `health.service.spec.ts`:
```ts
import type { Connection } from 'mongoose';
import { HealthService } from './health.service';

const make = (db: unknown) => new HealthService({ db } as unknown as Connection);

describe('HealthService', () => {
  it('is up when Mongo answers ping', async () => {
    const command = jest.fn().mockResolvedValue({ ok: 1 });
    await expect(make({ command }).isDatabaseUp()).resolves.toBe(true);
    expect(command).toHaveBeenCalledWith({ ping: 1 });
  });
  it('is down (never throws) when ping fails', async () => {
    await expect(make({ command: jest.fn().mockRejectedValue(new Error('down')) }).isDatabaseUp()).resolves.toBe(false);
  });
  it('is down when there is no database handle', async () => {
    await expect(make(undefined).isDatabaseUp()).resolves.toBe(false);
  });
});
```
Write `health.controller.spec.ts`:
```ts
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

const make = (up: boolean) => new HealthController({ isDatabaseUp: jest.fn().mockResolvedValue(up) } as unknown as HealthService);

describe('HealthController', () => {
  it('returns ok when the database is up', async () => {
    await expect(make(true).check()).resolves.toEqual({ status: 'ok' });
  });
  it('maps a down database to 503', async () => {
    await expect(make(false).check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
```
Run `npm run test:unit -w backend -- health` → FAIL (modules missing). Then implement:

`health/health.service.ts`
```ts
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Infrastructure exception: the only non-repository code allowed to use Mongoose, and only through the
 * Connection for a liveness ping (no models, no data access). Anything more than a ping belongs in a repository.
 */
@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async isDatabaseUp(): Promise<boolean> {
    try {
      const db = this.connection.db;
      if (!db) return false;
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
```
`health/health.controller.ts` (HTTP only)
```ts
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    if (!(await this.health.isDatabaseUp())) throw new ServiceUnavailableException('Database unavailable');
    return { status: 'ok' };
  }
}
```
`health/health.module.ts`
```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({ controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
```
Re-run: `npm run test:unit -w backend -- health` → PASS.

- [ ] **Step 4: Auth controller, throttle decorator, module**

`auth/auth-throttle.ts`
```ts
import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLED = 'authThrottled';
/** Marks a handler as subject to the strict `auth` throttler (signin/signup). */
export const AuthThrottled = (): MethodDecorator => SetMetadata(AUTH_THROTTLED, true);
```
`auth/auth.controller.ts`
```ts
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CLOCK, Clock } from '../../common/clock';
import type { Env } from '../../config/env.schema';
import { PublicUser, UsersService } from '../users/users.service';
import { AuthThrottled } from './auth-throttle';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { sessionCookieOptions } from './session-cookie';
import { SessionGuard } from './session.guard';
import { destroySession, startAuthenticatedSession } from './session.util';
import './session.types';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookieOptions: ReturnType<typeof sessionCookieOptions>;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService<Env, true>,
  ) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.cookieOptions = sessionCookieOptions(config.get('NODE_ENV', { infer: true }));
  }

  @Post('signup')
  @HttpCode(201)
  @AuthThrottled()
  async signUp(@Body() dto: SignUpDto, @Req() req: Request): Promise<{ user: PublicUser }> {
    const user = await this.auth.signUp(dto);
    await startAuthenticatedSession(req, user.id, this.clock.now());
    return { user: this.users.toPublic(user) };
  }

  @Post('signin')
  @HttpCode(200)
  @AuthThrottled()
  async signIn(@Body() dto: SignInDto, @Req() req: Request): Promise<{ user: PublicUser }> {
    const user = await this.auth.signIn(dto.email, dto.password);
    await startAuthenticatedSession(req, user.id, this.clock.now());
    return { user: this.users.toPublic(user) };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await destroySession(req);
    res.clearCookie(this.cookieName, this.cookieOptions);
  }

  /** The protected endpoint. */
  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ user: PublicUser }> {
    const userId = req.session.userId;
    const user = userId ? await this.users.findById(userId) : null;
    if (!user) {
      await destroySession(req);
      res.clearCookie(this.cookieName, this.cookieOptions);
      throw new UnauthorizedException('Authentication required');
    }
    return { user: this.users.toPublic(user) };
  }
}
```
`auth/auth.module.ts`
```ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { SessionGuard } from './session.guard';
import { SessionStoreService } from './session-store';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, SessionGuard, SessionStoreService],
  exports: [SessionStoreService],
})
export class AuthModule {}
```

- [ ] **Step 5: Rewrite `app.module.ts`**

```ts
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import { CsrfGuard } from './common/csrf.guard';
import { buildPinoHttpOptions } from './common/logging';
import { appConfigModule } from './config/config.module';
import type { Env } from './config/env.schema';
import { AUTH_THROTTLED } from './modules/auth/auth-throttle';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({})
export class AppModule {
  static register(overrides: Record<string, unknown> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        appConfigModule(overrides),
        LoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            pinoHttp: buildPinoHttpOptions(config.get('LOG_LEVEL', { infer: true })),
          }),
        }),
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            uri: config.get('MONGODB_URI', { infer: true }),
            serverSelectionTimeoutMS: 5000,
            retryAttempts: 0, // fail fast at boot
          }),
        }),
        ThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => [
            { name: 'default', ttl: 60_000, limit: config.get('THROTTLE_LIMIT', { infer: true }) },
            {
              name: 'auth',
              ttl: 60_000,
              limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
              skipIf: (ctx) => !new Reflector().get<boolean>(AUTH_THROTTLED, ctx.getHandler()),
            },
          ],
        }),
        CommonModule,
        UsersModule,
        AuthModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
      ],
    };
  }
}
```
If `skipIf` is not accepted per-throttler by the installed `@nestjs/throttler` typings, TypeScript fails here: use the installed version's documented per-throttler skip option; the Task 12 rate-limit test is the behavioural proof either way.

- [ ] **Step 6: Create `app.setup.ts` and rewrite `main.ts`**

`app.setup.ts`
```ts
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { SESSION_ABSOLUTE_TTL_MS } from './common/constants';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestIdMiddleware } from './common/request-id.middleware';
import type { Env } from './config/env.schema';
import { sessionCookieOptions } from './modules/auth/session-cookie';
import { SessionStoreService } from './modules/auth/session-store';

const toDetails = (errors: ValidationError[]) =>
  errors.map((e) => ({ field: e.property, messages: Object.values(e.constraints ?? {}) }));

/** Shared by main.ts and the integration tests so both run the exact same pipeline. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  const hops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (hops > 0) app.set('trust proxy', hops);

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.use(
    session({
      name: config.get('SESSION_COOKIE_NAME', { infer: true }),
      secret: config.get('SESSION_SECRET', { infer: true }),
      resave: false,
      saveUninitialized: false,
      rolling: false,
      store: app.get(SessionStoreService).store,
      cookie: { ...sessionCookieOptions(nodeEnv), maxAge: SESSION_ABSOLUTE_TTL_MS },
    }),
  );
  app.useBodyParser('json', { limit: '16kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException({ message: 'Validation failed', details: toDetails(errors) }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}
```
`main.ts`
```ts
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(), { bufferLogs: true });
  configureApp(app);
  await app.listen(app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true }));
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(`Failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 7: Test helper `backend/test/helpers/app.ts`**

```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CLOCK, Clock } from '../../src/common/clock';
import { createTestDatabase } from './db';

export const ORIGIN = 'http://localhost:5173';

export class MutableClock implements Clock {
  constructor(private current = Date.now()) {}
  now(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

export interface TestApp {
  app: NestExpressApplication;
  clock: MutableClock;
  /** Name of the isolated auth_test_<12 hex> database used by both users and sessions. */
  dbName: string;
  agent(): ReturnType<typeof request.agent>;
  close(): Promise<void>;
}

// The harness owns the database: callers may not point the app at another one.
const FORBIDDEN_OVERRIDES = ['MONGODB_URI', 'TEST_MONGODB_URI'];

/** Boots the real pipeline against a real MongoDB in a unique auth_test_ database; `env` overrides other config. */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const forbidden = FORBIDDEN_OVERRIDES.filter((key) => key in env);
  if (forbidden.length > 0) {
    throw new Error(`createTestApp: ${forbidden.join(', ')} cannot be overridden; the harness owns the isolated database URI`);
  }

  const db = createTestDatabase(); // validates the base URI before anything is created
  const clock = new MutableClock();
  let moduleRef: TestingModule | undefined;
  let app: NestExpressApplication | undefined;

  const cleanup = async (): Promise<void> => {
    const failures: unknown[] = [];
    try {
      await (app ?? moduleRef)?.close();
    } catch (err) {
      failures.push(err);
    }
    try {
      await db.drop(); // re-verifies the auth_test_ name; a no-op error-free drop if the database never existed
    } catch (err) {
      failures.push(err);
    }
    if (failures.length > 0) throw new AggregateError(failures, `Test cleanup failed for ${db.name}`);
  };

  try {
    // MONGODB_URI is applied last so nothing else can replace it. ConfigService feeds the same value to
    // Mongoose (users) and connect-mongo (sessions), so both live in the isolated database.
    moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ ...env, MONGODB_URI: db.uri })] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    app = nestApp;
    configureApp(nestApp);
    await nestApp.init();
    return {
      app: nestApp,
      clock,
      dbName: db.name,
      agent: () => request.agent(nestApp.getHttpServer()),
      close: cleanup,
    };
  } catch (err) {
    await cleanup().catch((cleanupErr: unknown) => {
      process.stderr.write(`Cleanup after failed test-app init also failed: ${String(cleanupErr)}\n`);
    });
    throw err;
  }
}
```

- [ ] **Step 8: Write the failing integration suite `backend/test/auth.int-spec.ts`**

```ts
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { SESSION_ABSOLUTE_TTL_MS } from '../src/common/constants';
import { createTestApp, ORIGIN, TestApp } from './helpers/app';

const valid = { email: 'alice@example.com', name: 'Alice', password: 'Passw0rd!' };
const setCookie = (res: request.Response): string[] => (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
const sid = (res: request.Response): string => setCookie(res)[0]?.split(';')[0] ?? '';

describe('auth (real MongoDB)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  const post = (agent: ReturnType<TestApp['agent']>, path: string, body?: object) =>
    agent.post(`/api${path}`).set('Origin', ORIGIN).send(body);

  describe('POST /auth/signup', () => {
    it('201: creates the user, starts a session, leaks nothing sensitive', async () => {
      const res = await post(t.agent(), '/auth/signup', valid).expect(201);
      expect(res.body.user).toMatchObject({ email: valid.email, name: valid.name });
      expect(res.body.user.id).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Passw0rd|argon2/);
      const cookie = setCookie(res)[0] ?? '';
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/;\s*Secure/i); // NODE_ENV=test
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('409 for the same email in a different case/padding', async () => {
      const res = await post(t.agent(), '/auth/signup', { ...valid, email: '  ALICE@Example.com ' }).expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict', message: 'Email already registered' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('exactly one of many concurrent duplicate signups succeeds', async () => {
      const body = { email: 'race@example.com', name: 'Racer', password: 'Passw0rd!' };
      const results = await Promise.all(Array.from({ length: 5 }, () => post(t.agent(), '/auth/signup', body)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    });

    it.each([
      ['bad email', { ...valid, email: 'nope' }, 'email'],
      ['name of 2 chars', { ...valid, email: 'n1@example.com', name: 'ab' }, 'name'],
      ['whitespace-only name', { ...valid, email: 'n2@example.com', name: '    ' }, 'name'],
      ['password too short', { ...valid, email: 'n3@example.com', password: 'a1!' }, 'password'],
      ['password without special', { ...valid, email: 'n4@example.com', password: 'abcdefg12' }, 'password'],
      ['password with space as the only "special"', { ...valid, email: 'n5@example.com', password: 'abc def 12' }, 'password'],
      ['129-char password', { ...valid, email: 'n6@example.com', password: 'a1!' + 'x'.repeat(126) }, 'password'],
      ['unknown extra field', { ...valid, email: 'n7@example.com', role: 'admin' }, 'role'],
    ])('400 with field details: %s', async (_label, body, field) => {
      const res = await post(t.agent(), '/auth/signup', body).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request', message: 'Validation failed' });
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('400 for a missing body', async () => {
      await t.agent().post('/api/auth/signup').set('Origin', ORIGIN).expect(400);
    });
  });

  describe('sessions', () => {
    it('signup leaves the caller signed in; /me returns the user', async () => {
      const agent = t.agent();
      await post(agent, '/auth/signup', { email: 'bob@example.com', name: 'Bobby', password: 'Passw0rd!' }).expect(201);
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.user).toMatchObject({ email: 'bob@example.com', name: 'Bobby' });
    });

    it('/me without a session is 401', async () => {
      const res = await t.agent().get('/api/auth/me').expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, message: 'Authentication required' });
    });

    it('stores only userId and absoluteExpiresAt (plus express-session cookie) in the session', async () => {
      const res = await post(t.agent(), '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const conn = t.app.get<Connection>(getConnectionToken());
      const docs = await conn.collection('sessions').find({}).toArray();
      expect(docs.length).toBeGreaterThan(0);
      for (const doc of docs) {
        const data = typeof doc.session === 'string' ? JSON.parse(doc.session) : doc.session;
        expect(Object.keys(data).sort()).toEqual(['absoluteExpiresAt', 'cookie', 'userId'].filter((k) => k in data));
        expect(Object.keys(data)).not.toEqual(expect.arrayContaining(['email', 'password', 'passwordHash', 'name']));
      }
      expect(res.body.user.email).toBe(valid.email);
    });

    it('regenerates the session id on every signin and invalidates the old one', async () => {
      const agent = t.agent();
      const first = await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const second = await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      expect(sid(first)).not.toBe('');
      expect(sid(second)).not.toBe(sid(first));
      await request(t.app.getHttpServer()).get('/api/auth/me').set('Cookie', sid(first)).expect(401);
      await request(t.app.getHttpServer()).get('/api/auth/me').set('Cookie', sid(second)).expect(200);
    });

    it('logout destroys the server-side session: replaying the cookie is 401', async () => {
      const agent = t.agent();
      const login = await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const cookie = sid(login);
      const out = await post(agent, '/auth/logout').expect(204);
      expect(setCookie(out)[0] ?? '').toMatch(/^sid=;/);
      await request(t.app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
    });

    it('logout without a session is 401', async () => {
      await post(t.agent(), '/auth/logout').expect(401);
    });

    it('enforces absoluteExpiresAt on the server regardless of cookie/TTL', async () => {
      const agent = t.agent();
      await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      t.clock.advance(SESSION_ABSOLUTE_TTL_MS - 1);
      await agent.get('/api/auth/me').expect(200);
      t.clock.advance(1);
      const expired = await agent.get('/api/auth/me').expect(401);
      expect(expired.body.message).toBe('Session expired');
      expect(setCookie(expired)[0] ?? '').toMatch(/^sid=;/);
      const again = await agent.get('/api/auth/me').expect(401);
      expect(again.body.message).toBe('Authentication required'); // session was destroyed
    });

    it('a session whose user was deleted is destroyed and gets 401', async () => {
      const agent = t.agent();
      await post(agent, '/auth/signup', { email: 'ghost@example.com', name: 'Ghost', password: 'Passw0rd!' }).expect(201);
      const conn = t.app.get<Connection>(getConnectionToken());
      await conn.collection('users').deleteOne({ email: 'ghost@example.com' });
      const res = await agent.get('/api/auth/me').expect(401);
      expect(setCookie(res)[0] ?? '').toMatch(/^sid=;/);
    });
  });

  describe('POST /auth/signin', () => {
    it('401 with the identical generic body for unknown email and wrong password', async () => {
      const unknown = await post(t.agent(), '/auth/signin', { email: 'nobody@example.com', password: 'Whatever1!' }).expect(401);
      const wrong = await post(t.agent(), '/auth/signin', { email: valid.email, password: 'Wrong-pass1!' }).expect(401);
      const strip = ({ requestId: _r, ...rest }: Record<string, unknown>) => rest;
      expect(strip(unknown.body)).toEqual(strip(wrong.body));
      expect(unknown.body.message).toBe('Invalid email or password');
      expect(setCookie(unknown)).toHaveLength(0);
      expect(setCookie(wrong)).toHaveLength(0);
    });

    it('does not re-apply the password policy on signin (weak password is just 401)', async () => {
      await post(t.agent(), '/auth/signin', { email: valid.email, password: 'weak' }).expect(401);
    });

    it('400 for a malformed email or empty password', async () => {
      await post(t.agent(), '/auth/signin', { email: 'bad', password: 'x' }).expect(400);
      await post(t.agent(), '/auth/signin', { email: valid.email, password: '' }).expect(400);
    });
  });

  describe('database isolation', () => {
    it('users and sessions both live in the generated auth_test_ database', async () => {
      expect(t.dbName).toMatch(/^auth_test_[0-9a-f]{12}$/);
      const conn = t.app.get<Connection>(getConnectionToken());
      expect(conn.db?.databaseName).toBe(t.dbName);
      await post(t.agent(), '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const db = conn.getClient().db(t.dbName);
      expect(await db.collection('users').countDocuments()).toBeGreaterThan(0);
      expect(await db.collection('sessions').countDocuments()).toBeGreaterThan(0);
    });
  });

  describe('GET /health', () => {
    it('200 when Mongo is reachable', async () => {
      const res = await t.agent().get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
```

- [ ] **Step 8b: Test the `createTestApp` guards in `backend/test/test-app.int-spec.ts`**

```ts
import { createTestApp } from './helpers/app';

describe('createTestApp', () => {
  it.each(['MONGODB_URI', 'TEST_MONGODB_URI'])('refuses to let callers override %s', async (key) => {
    await expect(createTestApp({ [key]: 'mongodb://127.0.0.1:27017/easygenerator' })).rejects.toThrow(new RegExp(key));
  });

  it('cleans up and rethrows when initialisation fails, leaving later apps unaffected', async () => {
    await expect(createTestApp({ SESSION_SECRET: 'short' })).rejects.toThrow(/SESSION_SECRET/);
    const t = await createTestApp();
    await t.close();
  });
});
```
Run `npm run test:int -w backend -- test-app` → PASS (after Step 7's helper exists).

- [ ] **Step 9: Start Mongo and run the suite to see it pass**

Run: `docker compose -f backend/docker-compose.yml up -d mongo && npm run test:int -w backend -- auth.int`
Expected: PASS. If a test fails, fix the **code**, not the test, unless the test contradicts the spec. Known risks to check first: (a) `skipIf` typing/behaviour in `AppModule` (Task 12's rate-limit test also covers it), (b) body-parser errors not reaching the envelope (Task 12 covers it; if they bypass `HttpExceptionFilter`, add an Express error-handling middleware in `configureApp` that delegates to the filter), (c) `connect-mongo` storing `session` as string vs object (the test handles both).

- [ ] **Step 10: Whole-project checks, then commit**

```bash
npm run lint && npm run typecheck && npm run test:unit && npm run build
git add backend && git commit -m "feat(backend): wire auth endpoints, health, session pipeline and integration tests"
```

---

### Task 12: Security integration suite (CSRF, CORS, headers, limits, throttling, envelope)

**Files:**
- Test: `backend/test/security.int-spec.ts`
- Modify: only what a failing test proves is wrong (expected: none or small fixes in `app.setup.ts` / `app.module.ts`)

**Interfaces:**
- Consumes: `createTestApp`, `ORIGIN`, `MutableClock` (Task 11).
- Produces: pinned behaviour for the Review Focus items 3, 5 and the throttling/CORS/helmet requirements.

- [ ] **Step 1: Write the suite**

```ts
import request from 'supertest';
import { createTestApp, ORIGIN, TestApp } from './helpers/app';

const creds = { email: 'sec@example.com', name: 'Secure', password: 'Passw0rd!' };

describe('security (real MongoDB)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    await t.agent().post('/api/auth/signup').set('Origin', ORIGIN).send(creds).expect(201);
  });
  afterAll(() => t.close());

  describe('CSRF fails closed on unsafe methods', () => {
    const routes = [
      ['/api/auth/signup', { email: 'x1@example.com', name: 'Xavier', password: 'Passw0rd!' }],
      ['/api/auth/signin', { email: creds.email, password: creds.password }],
      ['/api/auth/logout', {}],
    ] as const;

    it.each(routes)('%s: no Origin and no Referer -> 403', async (path, body) => {
      const res = await t.agent().post(path).send(body).expect(403);
      expect(res.body).toMatchObject({ statusCode: 403, error: 'Forbidden', message: 'CSRF check failed' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it.each(routes)('%s: foreign Origin -> 403', async (path, body) => {
      await t.agent().post(path).set('Origin', 'https://evil.example').send(body).expect(403);
    });

    it.each(routes)('%s: literal "null" Origin -> 403', async (path, body) => {
      await t.agent().post(path).set('Origin', 'null').send(body).expect(403);
    });

    it('Sec-Fetch-Site: cross-site is rejected even with the right Origin', async () => {
      await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).set('Sec-Fetch-Site', 'cross-site')
        .send({ email: creds.email, password: creds.password }).expect(403);
    });

    it('falls back to a matching Referer when Origin is absent', async () => {
      await t.agent().post('/api/auth/signin').set('Referer', `${ORIGIN}/signin`)
        .send({ email: creds.email, password: creds.password }).expect(200);
    });

    it('a foreign Referer without Origin is rejected', async () => {
      await t.agent().post('/api/auth/signin').set('Referer', 'https://evil.example/')
        .send({ email: creds.email, password: creds.password }).expect(403);
    });

    it('safe methods do not need Origin', async () => {
      await t.agent().get('/api/health').expect(200);
    });
  });

  describe('CORS', () => {
    it('answers the preflight for the configured origin with credentials', async () => {
      const res = await t.agent().options('/api/auth/signin')
        .set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
    it('does not grant any other origin', async () => {
      const res = await t.agent().options('/api/auth/signin')
        .set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('hardening', () => {
    it('sends helmet headers and hides the framework', async () => {
      const res = await t.agent().get('/api/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('echoes a safe client X-Request-Id and replaces an unsafe one', async () => {
      const ok = await t.agent().get('/api/health').set('X-Request-Id', 'client-req-12345');
      expect(ok.headers['x-request-id']).toBe('client-req-12345');
      const bad = await t.agent().get('/api/health').set('X-Request-Id', 'a b');
      expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('413 in the envelope for a body over 16 kb', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN)
        .send({ email: creds.email, password: 'x'.repeat(20_000) }).expect(413);
      expect(res.body).toMatchObject({ statusCode: 413, message: 'Request body too large' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('400 in the envelope for malformed JSON', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN)
        .set('Content-Type', 'application/json').send('{"email": ').expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Malformed JSON body' });
    });

    it('404 uses the envelope too, without stack traces', async () => {
      const res = await t.agent().get('/api/nope').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
      expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
    });

    it('rejects a non-JSON content type body as a validation error', async () => {
      await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).set('Content-Type', 'text/plain').send('email=a').expect(400);
    });
  });
});

describe('rate limiting (real MongoDB)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ AUTH_THROTTLE_LIMIT: '3', THROTTLE_LIMIT: '1000' });
  });
  afterAll(() => t.close());

  it('429 in the envelope after the strict auth limit; other routes unaffected', async () => {
    const agent = t.agent();
    const attempt = () => agent.post('/api/auth/signin').set('Origin', ORIGIN).send({ email: 'nobody@example.com', password: 'Whatever1!' });
    for (let i = 0; i < 3; i += 1) await attempt().expect(401);
    const limited = await attempt().expect(429);
    expect(limited.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests', message: 'Too many requests, please try again later' });
    await request(t.app.getHttpServer()).get('/api/health').expect(200);
  });
});
```

- [ ] **Step 2: Run** — `npm run test:int -w backend -- security.int`. Expected: PASS. Failures are real findings: fix the code (not the test) and record each in `docs/AI-LOG.md` under **Correction**.

- [ ] **Step 3: Whole-project checks** — `npm run lint && npm run typecheck && npm run test:unit && npm run test:int && npm run build` → all exit 0.

- [ ] **Step 4: Commit** — `git add backend && git commit -m "test(backend): add CSRF, CORS, hardening and rate-limit integration suite"`

---

### Task 13: OpenAPI contract, Swagger UI and contract-drift test

**Files:**
- Create: `contracts/openapi.yaml`, `backend/src/docs/swagger.ts`
- Modify: `backend/src/app.setup.ts` (call `setupSwagger(app)` before `app.listen` is possible, i.e. at the end of `configureApp`)
- Test: `backend/test/contract.int-spec.ts`

**Interfaces:**
- Produces: `setupSwagger(app: INestApplication): void` serving the YAML at `GET /api/docs` (UI) and `GET /api/docs-json`. The contract is the source of truth; no `@nestjs/swagger` decorators are used anywhere.

- [ ] **Step 1: Write `contracts/openapi.yaml`**

```yaml
openapi: 3.1.0
info:
  title: Easygenerator Auth API
  version: 0.1.0
  description: |
    Cookie-session authentication (sign up, sign in, logout, protected `me`).
    The session cookie is `httpOnly`, `SameSite=Lax`. Every unsafe request (POST) must carry an `Origin`
    header equal to the configured frontend origin (or a matching `Referer`); otherwise it fails closed with 403.
    Supported topology: frontend and API on the same site.
servers:
  - url: /api
tags:
  - name: auth
  - name: health
paths:
  /auth/signup:
    post:
      tags: [auth]
      operationId: signUp
      summary: Create an account and start a session
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SignUpRequest' }
      responses:
        '201':
          description: Account created; session cookie set.
          headers:
            Set-Cookie: { $ref: '#/components/headers/SetCookie' }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserEnvelope' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '409':
          description: Email already registered.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
        '413': { $ref: '#/components/responses/PayloadTooLarge' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
  /auth/signin:
    post:
      tags: [auth]
      operationId: signIn
      summary: Verify credentials and start a session (new session id)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SignInRequest' }
      responses:
        '200':
          description: Signed in; session cookie set.
          headers:
            Set-Cookie: { $ref: '#/components/headers/SetCookie' }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserEnvelope' }
        '400': { $ref: '#/components/responses/ValidationError' }
        '401':
          description: Invalid email or password (identical for unknown email and wrong password).
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '413': { $ref: '#/components/responses/PayloadTooLarge' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
  /auth/logout:
    post:
      tags: [auth]
      operationId: logout
      summary: Destroy the server-side session and clear the cookie
      security: [{ cookieAuth: [] }]
      responses:
        '204': { description: Logged out. }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
  /auth/me:
    get:
      tags: [auth]
      operationId: getMe
      summary: Protected endpoint - the current user
      security: [{ cookieAuth: [] }]
      responses:
        '200':
          description: The authenticated user.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserEnvelope' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/TooManyRequests' }
  /health:
    get:
      tags: [health]
      operationId: getHealth
      summary: Liveness and MongoDB ping
      responses:
        '200':
          description: Healthy.
          content:
            application/json:
              schema:
                type: object
                required: [status]
                properties:
                  status: { type: string, enum: [ok] }
        '503':
          description: Database unavailable.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: sid
  headers:
    SetCookie:
      description: Session cookie (`sid`), httpOnly, SameSite=Lax, Secure in production, 7-day absolute lifetime.
      schema: { type: string }
  schemas:
    SignUpRequest:
      type: object
      additionalProperties: false
      required: [email, name, password]
      properties:
        email: { type: string, format: email, maxLength: 254, description: Trimmed and lowercased by the server. }
        name: { type: string, minLength: 3, maxLength: 80, description: Trimmed by the server. }
        password:
          type: string
          minLength: 8
          maxLength: 128
          description: >-
            At least one letter [A-Za-z], one digit [0-9] and one special character from the ASCII
            punctuation set. A space is not a special character.
          pattern: '^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\[-`{-~]).{8,128}$'
    SignInRequest:
      type: object
      additionalProperties: false
      required: [email, password]
      properties:
        email: { type: string, format: email, maxLength: 254 }
        password: { type: string, minLength: 1 }
    User:
      type: object
      required: [id, email, name, createdAt]
      properties:
        id: { type: string }
        email: { type: string, format: email }
        name: { type: string }
        createdAt: { type: string, format: date-time }
    UserEnvelope:
      type: object
      required: [user]
      properties:
        user: { $ref: '#/components/schemas/User' }
    Error:
      type: object
      required: [statusCode, error, message, requestId]
      properties:
        statusCode: { type: integer }
        error: { type: string }
        message: { type: string }
        requestId: { type: string }
        details:
          type: array
          items:
            type: object
            required: [field, messages]
            properties:
              field: { type: string }
              messages: { type: array, items: { type: string } }
  responses:
    ValidationError:
      description: Validation failed (per-field `details`) or malformed JSON.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    Unauthorized:
      description: Missing, invalid or expired session.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    Forbidden:
      description: CSRF check failed (missing/mismatched Origin and Referer).
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    PayloadTooLarge:
      description: Request body over 16 kb.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
    TooManyRequests:
      description: Rate limit exceeded.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/Error' }
```

- [ ] **Step 2: Lint the contract** — `npm run lint:api -w backend`. Expected: no errors (warnings such as a missing license are acceptable; fix any error).

- [ ] **Step 3: Write the failing drift/docs test `backend/test/contract.int-spec.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parse } from 'yaml';
import { createTestApp, TestApp } from './helpers/app';

const HTTP = ['get', 'post', 'put', 'patch', 'delete'];

function contractOperations(): string[] {
  const doc = parse(readFileSync(join(__dirname, '..', '..', 'contracts', 'openapi.yaml'), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  return Object.entries(doc.paths)
    .flatMap(([path, item]) => Object.keys(item).filter((m) => HTTP.includes(m)).map((m) => `${m.toUpperCase()} /api${path}`))
    .sort();
}

function registeredRoutes(app: NestExpressApplication): string[] {
  const routes = new Set<string>();
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as (new () => object) | null;
      if (!ctrl) continue;
      const base = Reflect.getMetadata(PATH_METADATA, ctrl) as string;
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const handler = (ctrl.prototype as Record<string, unknown>)[name] as object;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (method === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const path = [base, sub].filter((p) => p && p !== '/').join('/');
        routes.add(`${RequestMethod[method]} /api/${path}`);
      }
    }
  }
  return [...routes].sort();
}

describe('API contract', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('every contract operation is a registered route and vice versa (no drift)', () => {
    expect(registeredRoutes(t.app)).toEqual(contractOperations());
  });

  it('serves the contract through Swagger UI', async () => {
    const ui = await t.agent().get('/api/docs').expect(200);
    expect(ui.headers['content-type']).toMatch(/html/);
    const json = await t.agent().get('/api/docs-json').expect(200);
    expect(json.body.openapi).toBe('3.1.0');
    expect(Object.keys(json.body.paths)).toContain('/auth/signup');
  });
});
```

- [ ] **Step 4: Run to verify it fails** — `npm run test:int -w backend -- contract` → FAIL (`/api/docs` is 404; the drift assertion may already pass).

- [ ] **Step 5: Implement `src/docs/swagger.ts` and call it**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { parse } from 'yaml';

// Layout is identical in dev (backend/src/docs), build (backend/dist/docs) and Docker (/app/backend/dist/docs):
// three levels up is the repo root that holds contracts/.
const CONTRACT_PATH = join(__dirname, '..', '..', '..', 'contracts', 'openapi.yaml');

export function setupSwagger(app: INestApplication): void {
  const document = parse(readFileSync(CONTRACT_PATH, 'utf8')) as OpenAPIObject;
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
}
```
In `app.setup.ts` add `import { setupSwagger } from './docs/swagger';` and call `setupSwagger(app);` as the last line of `configureApp`.

- [ ] **Step 6: Run to verify it passes** — `npm run test:int -w backend -- contract` → PASS. Manual check once: `npm run start:dev -w backend` (with a real `.env`), open `http://localhost:3000/api/docs`. If helmet's CSP blocks the UI scripts in the browser, relax the CSP only for `/api/docs` (e.g. a small middleware before `helmet()` that applies a looser `contentSecurityPolicy` for that path) and add a test pinning that every other path keeps the strict default.

- [ ] **Step 7: Commit** — `git add contracts backend && git commit -m "feat(backend): add OpenAPI contract, Swagger UI and contract-drift test"`

---

### Task 14: Docker image, compose app profile, argon2 benchmark

**Files:**
- Create: `backend/Dockerfile`, `backend/Dockerfile.dockerignore`, `backend/scripts/bench-argon2.ts`
- Modify: `backend/docker-compose.yml` (add `api` service under profile `app`)

**Interfaces:**
- Produces: image built from the **repo root** context (`docker build -f backend/Dockerfile .`), runtime layout `/app/backend/dist` + `/app/contracts` (matches `swagger.ts`), non-root `node` user, `HEALTHCHECK` on `/api/health`; `npm run bench:argon2 -w backend`.

- [ ] **Step 1: Write `backend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci
COPY backend backend
RUN npm run build -w backend && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/backend/dist backend/dist
COPY --from=build --chown=node:node /app/backend/package.json backend/package.json
COPY --chown=node:node contracts contracts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/main.js"]
```
`backend/Dockerfile.dockerignore`
```
**/node_modules
**/dist
**/coverage
**/.env
**/.env.*
.git
frontend
docs
*.pdf
```

- [ ] **Step 2: Add the `api` service to `backend/docker-compose.yml`**

```yaml
  api:
    profiles: ["app"]
    build:
      context: ..
      dockerfile: backend/Dockerfile
    depends_on:
      mongo: { condition: service_healthy }
    ports: ["3000:3000"]
    environment:
      NODE_ENV: development # production sets Secure cookies, which need HTTPS
      MONGODB_URI: mongodb://mongo:27017/easygenerator
      SESSION_SECRET: ${SESSION_SECRET:?generate one with: openssl rand -base64 32}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:5173}
```

- [ ] **Step 3: Write `backend/scripts/bench-argon2.ts`**

```ts
import { performance } from 'node:perf_hooks';
import * as argon2 from 'argon2';

const memoryCost = Number(process.env.ARGON2_MEMORY_KIB ?? 19456);
const timeCost = Number(process.env.ARGON2_TIME_COST ?? 2);
const parallelism = Number(process.env.ARGON2_PARALLELISM ?? 1);
const RUNS = 10;

async function main(): Promise<void> {
  if (memoryCost < 19456 || timeCost < 2 || parallelism < 1) {
    process.stderr.write('Parameters are below the OWASP minimum (19456 KiB, t=2, p=1); the app would refuse to start.\n');
    process.exit(1);
  }
  const times: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    await argon2.hash('benchmark-password-1!', { type: argon2.argon2id, memoryCost, timeCost, parallelism });
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / RUNS;
  process.stdout.write(`argon2id m=${memoryCost}KiB t=${timeCost} p=${parallelism}: avg ${avg.toFixed(1)} ms over ${RUNS} hashes\n`);
  process.stdout.write('Run this on the deployment target and raise memory/time while signin latency stays acceptable.\n');
}

void main();
```

- [ ] **Step 4: Verify** — from the repo root:
```bash
npm run bench:argon2 -w backend
docker build -f backend/Dockerfile -t eg-backend:local .
SESSION_SECRET=$(openssl rand -base64 32) docker compose -f backend/docker-compose.yml --profile app up -d --build
curl -s http://localhost:3000/api/health
docker compose -f backend/docker-compose.yml --profile app down
```
Expected: benchmark prints an average; the image builds; health returns `{"status":"ok"}`. Also confirm the container runs as non-root: `docker run --rm eg-backend:local id -u` prints `1000`.

- [ ] **Step 5: Commit** — `git add backend && git commit -m "feat(backend): add non-root Docker image, compose app profile and argon2 benchmark"`

---

### Task 15: Shared CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: required checks `backend`, `frontend` (no-op until `frontend/package.json` exists), `docker`. No deploy job.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: ["27017:27017"]
        options: >-
          --health-cmd "mongosh --quiet --eval 'db.adminCommand({ping:1}).ok'"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      MONGODB_URI: mongodb://127.0.0.1:27017
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Typecheck (strict)
        run: npm run typecheck
      - name: Lint OpenAPI contract
        run: npm run lint:api -w backend
      - name: Unit tests
        run: npm run test:unit
      - name: Integration tests (real MongoDB)
        run: npm run test:int
      - name: Build
        run: npm run build
      - name: Audit production dependencies
        run: npm audit --audit-level=high --omit=dev

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: has
        run: |
          if [ -f frontend/package.json ]; then echo "present=true" >> "$GITHUB_OUTPUT"; else echo "present=false" >> "$GITHUB_OUTPUT"; fi
      - if: steps.has.outputs.present == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - if: steps.has.outputs.present == 'true'
        run: npm ci
      - if: steps.has.outputs.present == 'true'
        run: npm run lint -w frontend
      - if: steps.has.outputs.present == 'true'
        run: npm run typecheck -w frontend
      - if: steps.has.outputs.present == 'true'
        run: npm test -w frontend --if-present
      - if: steps.has.outputs.present == 'true'
        run: npm run build -w frontend

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build backend image (build check only; nothing is pushed or deployed)
        run: |
          if [ -f backend/Dockerfile ]; then docker build -f backend/Dockerfile -t eg-backend:ci .; else echo "no backend/Dockerfile"; fi
      - name: Build frontend image (only if a Dockerfile exists)
        run: |
          if [ -f frontend/Dockerfile ]; then docker build -f frontend/Dockerfile -t eg-frontend:ci frontend; else echo "no frontend/Dockerfile"; fi
```

- [ ] **Step 2: Validate locally** — `npx -y @action-validator/cli .github/workflows/ci.yml` (or push and read the run). Expected: no schema errors.

- [ ] **Step 3: Commit** — `git add .github && git commit -m "ci: add shared workflow (lint, strict typecheck, tests on real MongoDB, build, docker check)"`

---

### Task 16: Docs, AI.md, full verification and PR

**Files:**
- Create: `README.md` (replaces GitHub's initial one), `AI.md`, `docs/system-design.md`, `docs/adr/0001-nestjs-mongoose.md`, `docs/adr/0002-cookie-sessions-in-mongodb.md`, `docs/adr/0003-same-site-topology-and-origin-check.md`, `docs/adr/0004-argon2id-parameters.md`, `docs/adr/0005-duplicate-email-disclosure.md`, `docs/adr/0006-monorepo-npm-workspaces.md`
- Modify: `docs/AI-LOG.md` (append implementation-phase entries)

**Interfaces:**
- Produces: a README a stranger can follow, `AI.md` assembled only from real `AI-LOG.md` entries, ADRs, a verified branch, an open PR with test evidence. The PR is **not** merged.

- [ ] **Step 1: ADRs** — each file uses `# ADR 000N — <title>`, then `Status: accepted (2026-10-15)`, `## Context`, `## Decision`, `## Consequences`. Content (copy from the spec, do not invent):
  - 0001: NestJS + Mongoose required by the task; Mongoose models only inside repositories, with `HealthService` as the single documented exception (connection ping, no models, no data access); controllers stay HTTP-only; Zod for env.
  - 0002: cookie sessions in MongoDB (user rejected access-JWT + rotating refresh); session holds `userId` + `absoluteExpiresAt`; absolute expiry enforced by `SessionGuard`, never by cookie/TTL; consequence: one DB round-trip per protected request.
  - 0003: same-site-only topology; fail-closed Origin→Referer check; cross-site would need `SameSite=None; Secure` plus a CSRF token (future work).
  - 0004: argon2id 19456 KiB / 2 / 1 floor, env-tunable, benchmark script; dummy verification narrows but does not equalise timing.
  - 0005: signup reveals duplicate emails (409); accepted trade-off, mitigated by the strict auth rate limit.
  - 0006: single repo with npm workspaces (replaced the earlier two-repo plan); shared CI and lockfile.

- [ ] **Step 2: `docs/system-design.md` (one page, ~60 lines max, written from the approved spec; no new design work)** with four short sections: (1) *High-level architecture* - a fenced text diagram `Browser -> Nest (global guards: Throttler, Csrf) -> Controller -> Service -> Repository -> MongoDB` plus the module list; (2) *Authentication flow* - signin/signup step list (validate -> hash/verify -> regenerate session -> store `userId` + `absoluteExpiresAt` -> cookie) and the protected-request path (`SessionGuard` checks `absoluteExpiresAt` every time); (3) *MongoDB collections* - `users` (fields, unique lowercase `email` index, `passwordHash` never selected by default) and `sessions` (connect-mongo, TTL index, only `userId` + `absoluteExpiresAt`); (4) *Key trade-offs* - cookie sessions vs JWT, same-site-only hosting, signup discloses duplicate emails, Argon2id floor vs latency, real MongoDB in tests. Link to the spec and ADRs for detail instead of repeating them.

- [ ] **Step 3: `README.md`** with these sections: overview; repo layout; prerequisites (Node 22, Docker); quick start (`docker compose -f backend/docker-compose.yml up -d mongo`, `cp backend/.env.example backend/.env`, set `SESSION_SECRET` from `openssl rand -base64 32`, `npm ci`, `npm run start:dev -w backend`); API summary table + `http://localhost:3000/api/docs`; curl examples that **include `-H 'Origin: http://localhost:5173'`** and `-c/-b` cookie jar; testing (`npm run test:unit`, `npm run test:int`, `npm run test:cov`; integration tests need a MongoDB server; set `TEST_MONGODB_URI` to a server URI **without** a database name — the harness creates and drops its own `auth_test_*` database, and non-local hosts need `ALLOW_REMOTE_TEST_DB=true`); argon2 benchmark; security notes (same-site only, fail-closed CSRF, absolute 7-day sessions); CI description; **Deployment: not configured. CI builds and verifies only; no deploy job exists**; link to `AI.md`.

- [ ] **Step 4: Append implementation-phase entries to `docs/AI-LOG.md`** — one per real event during Tasks 3–15 (any test the AI wrote wrong, any code fixed after a failing run, any library-API assumption that was wrong, e.g. throttler `skipIf`, body-parser errors, connect-mongo storage format). Use **Prompt / AI output / Correction / Decision**. Do not invent entries.

- [ ] **Step 5: Assemble `AI.md`** from the log with these headings: *Overview*; *Where AI was used* (table: area → what AI generated → how it was verified); *Workflow* (lean port of the VCare setup: CLAUDE.md, commands, skills, docs-first spec → plan → TDD); *Prompts that worked*; *Corrections and rework* (every `Correction` in the log); *Decisions that differ from AI suggestions* (cookie sessions over JWT+refresh; fail-closed CSRF; explicit argon2 parameters; explicit special-character set; `absoluteExpiresAt`; monorepo); *Verification*; *What I would do differently*. Every claim must trace to a log entry.

- [ ] **Step 6: Full local verification (record the output for the PR)**

```bash
docker compose -f backend/docker-compose.yml up -d mongo
npm ci
npm run lint
npm run typecheck
npm run lint:api -w backend
npm run test:unit
npm run test:int
npm run test:cov
npm run build
npm audit --audit-level=high --omit=dev
docker build -f backend/Dockerfile -t eg-backend:local .
```
Expected: every command exits 0; `test:cov` reports ≥ 80% statements/branches/functions/lines. If coverage is short, add tests for the uncovered code; do **not** lower the threshold.

- [ ] **Step 7: Verify the fail-fast boot and secret rules by hand**

```bash
MONGODB_URI=mongodb://127.0.0.1:1/x SESSION_SECRET=$(openssl rand -base64 32) CORS_ORIGIN=http://localhost:5173 node backend/dist/main.js ; echo "exit=$?"
SESSION_SECRET=short MONGODB_URI=mongodb://127.0.0.1:27017/x CORS_ORIGIN=http://localhost:5173 node backend/dist/main.js ; echo "exit=$?"
```
Expected: both print a clear error and `exit=1` (the first within about 10 s, the second immediately naming `SESSION_SECRET`).

- [ ] **Step 7b: Review gate** — run `/review-code` (correctness, security vs `backend/CLAUDE.md` Security rules, contract drift; each finding adversarially verified). Fix surviving findings via new commits, re-run the Step 6 checks, and log notable findings in `docs/AI-LOG.md`.

- [ ] **Step 8: Commit docs** — `git add README.md AI.md docs && git commit -m "docs: add README, ADRs, system design and AI.md"`

- [ ] **Step 9: Confirm with the user, then push and open the PR (do NOT merge)**

Ask the user to confirm the push. Then:
```bash
git push
gh pr create --base main --head feat/backend-auth --title "feat(backend): auth module (sign up / sign in) with CI and API contract" --body-file pr-body.md
```
`pr-body.md` (temporary file in the scratchpad, never committed) contains: summary; "Closes #<issue number from Task 1>"; the spec/plan links; a **Test evidence** section pasting the real output of Step 6 (test counts, coverage table, lint/typecheck/build/audit/docker results); the security decisions checklist; and "Deployment: not configured". Add the standard attribution line the harness requires.

- [ ] **Step 10: Watch CI and report** — `gh pr checks --watch`. Report to the user: repository URL, PR URL, each CI job result, and the remaining setup for deployment (no target or credentials exist yet). If a CI job fails, fix on the branch with a new commit (never amend/force-push), and re-run. Never merge the PR; the user merges.
