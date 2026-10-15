# ADR 0004 — argon2id parameters and the timing gap

Status: accepted (2026-10-15)

## Context
The AI first proposed "current recommended" argon2 settings without stating values. The project owner required
explicit OWASP-minimum parameters.

## Decision
- argon2id with memory 19456 KiB (19 MiB), time cost 2, parallelism 1 as the floor. Values are tunable through
  `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`; environment validation refuses lower values.
- `npm run bench:argon2 -w backend` measures hashing time so the values can be raised on the deployment target.
- For an unknown email, signin verifies a dummy hash so the response is not obviously faster than a wrong
  password.

## Consequences
- The dummy verification narrows, but does not guarantee equal, response times; this is stated rather than
  claimed away.
- Signup enforces the 128-character password limit before hashing. Signin does not re-apply the policy, so its
  input is bounded only by the 16 kb request body limit (JSON-only; form bodies are not parsed).
