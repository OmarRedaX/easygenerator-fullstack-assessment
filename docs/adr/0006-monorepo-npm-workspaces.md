# ADR 0006 — Single repository with npm workspaces

Status: accepted (2026-10-15)

## Context
The first design assumed two repositories (backend and frontend). Delivery changed to a monorepo mid-design
(see `docs/AI-LOG.md`, "Two repos to monorepo"); security decisions were unaffected.

## Decision
- One Git repository with a root `package.json` using npm workspaces and one lockfile. `backend` is a workspace
  now; `frontend` is added when it is scaffolded (an empty workspace directory breaks `npm ci`).
- Root scripts delegate to the backend workspace. One shared CI workflow covers both.
- `contracts/openapi.yaml` and `docs/` are shared at the root.

## Consequences
- One clone, one install, one CI definition, and a single place for the API contract.
- Backend and frontend still ship through separate issues, branches and pull requests.
