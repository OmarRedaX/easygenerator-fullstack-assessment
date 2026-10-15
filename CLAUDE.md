# CLAUDE.md — Easygenerator assessment (monorepo)

Binding for every human and agent. Cite sections by name, never by number.
Source of intent: `docs/superpowers/specs/2026-10-15-auth-assessment-design.md`. API truth: `contracts/openapi.yaml`.

## Repo layout
`backend/` NestJS + MongoDB (built first) · `frontend/` React + TS (later) · `docs/` · `contracts/` · `.claude/`.

## Workflow
`/brainstorm` → `/construct-spec` → `/develop` (tests first) → `/review-code` → `/update-docs`.
Backend must be complete and green before any frontend work.
The frontend is driven by spec-kit instead: `/speckit-constitution` → `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`, then `/review-code` and `/update-docs`. Its rules are in
`frontend/CLAUDE.md` and `.specify/memory/constitution.md`; the backend keeps the commands above.

## Git rules
Issue → `feat/...` branch → conventional commits → push → PR to `main` with test evidence.
Never commit to `main`. Never merge a PR automatically. Never commit `*.pdf`, `.env`, secrets.

## AI log duty
After every non-trivial AI-assisted step append an entry to `docs/AI-LOG.md`: the prompt, what the AI produced,
what was corrected, and any decision that differs from the AI's suggestion. `AI.md` is assembled from it.

## Doc placement
Repo-wide docs in `docs/`; the API contract in `contracts/`; backend rules in `backend/CLAUDE.md`.
