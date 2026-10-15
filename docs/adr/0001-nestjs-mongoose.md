# ADR 0001 — NestJS + Mongoose with strict layering

Status: accepted (2026-10-15)

## Context
The assessment requires a NestJS backend on MongoDB. We need a structure reviewers can read quickly and that keeps
persistence concerns out of HTTP code.

## Decision
- NestJS 11 with Mongoose. Strict layering: controller (HTTP only) → service (rules) → repository.
- Mongoose models are touched only inside repositories. The single exception is `HealthService`, which uses the
  Mongoose `Connection` solely to ping the database (no models, no data access); `HealthController` only maps the
  result to 200/503.
- Modules call each other through services, never another module's repository (`UsersModule` exports only
  `UsersService`).
- Zod validates environment variables at startup; class-validator validates request bodies.

## Consequences
- Rules are testable without a database (services take mocked repositories).
- The `HealthService` exception is documented here and in `backend/CLAUDE.md` so it cannot grow into data access.
- Two validation libraries exist (Zod for env, class-validator for DTOs); each is used where it fits best.
