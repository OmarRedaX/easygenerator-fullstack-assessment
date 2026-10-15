# AI Log

Running log of AI-assisted steps. Format: `## YYYY-MM-DD <topic>` with **Prompt / AI output / Correction / Decision**.
`AI.md` (root) is assembled from this file at the end.

## 2026-10-15 Session mechanism: JWT vs cookie sessions
- **Prompt:** Design the authentication mechanism for the signup/signin/me backend.
- **AI output:** Recommended an access JWT plus a rotating refresh token.
- **Correction:** User rejected the JWT recommendation and chose cookie sessions.
- **Decision:** Overrode the AI recommendation; cookie sessions are used.

## 2026-10-15 Argon2 hashing parameters
- **Prompt:** Choose password hashing settings for the backend.
- **AI output:** Proposed "current recommended" argon2 settings without stating exact values.
- **Correction:** User required explicit OWASP-minimum parameters instead of a vague "recommended" label.
- **Decision:** The spec states explicit OWASP-minimum argon2 parameters.

## 2026-10-15 CSRF rule and missing Origin header
- **Prompt:** Define the CSRF protection rule for unsafe requests.
- **AI output:** A CSRF rule that allowed requests carrying no Origin header.
- **Correction:** User required the rule to fail closed, with a Referer fallback.
- **Decision:** CSRF check fails closed: Origin, then Referer, otherwise reject.

## 2026-10-15 Hosting topology
- **Prompt:** Design the security model for the browser-to-API setup.
- **AI output:** Left the hosting topology implicit.
- **Correction:** User required the topology to be defined explicitly (same-site only).
- **Decision:** The spec defines a same-site-only topology.

## 2026-10-15 Secret length and special-character wording
- **Prompt:** Specify the session secret and password policy requirements.
- **AI output:** Used "32 characters" for the secret and "any non-alphanumeric" for the special-character rule.
- **Correction:** User required a secret of at least 32 bytes and an explicit set of special characters (space excluded).
- **Decision:** Spec uses a minimum of 32 bytes for the secret and an explicit special-character set that excludes space.

## 2026-10-15 Absolute session expiry enforcement
- **Prompt:** Specify how session lifetime is enforced.
- **AI output:** Relied on cookie/TTL expiry for session lifetime.
- **Correction:** User required explicit `absoluteExpiresAt` enforcement instead of relying on cookie/TTL expiry.
- **Decision:** Expiry is enforced explicitly via `absoluteExpiresAt`.

## 2026-10-15 Two repos to monorepo
- **Prompt:** Decide the delivery structure of the project.
- **AI output:** Initial design assumed two separate repositories.
- **Correction:** Delivery changed from two repos to a monorepo mid-design; the spec was updated.
- **Decision:** Monorepo adopted; security decisions unchanged.

## 2026-10-15 gh CLI missing
- **Prompt:** Execute the plan's Task 1, which uses `gh repo create` and `gh issue create`.
- **AI output:** Plan steps relying on the `gh` CLI, which is not installed on this Windows machine.
- **Correction:** Used the GitHub MCP tools (`create_repository`, `issue_write`) instead; they will also be used for the PR.
- **Decision:** Same outcome as planned; the user had confirmed a public repo named `easygenerator-fullstack-assessment`.

## 2026-10-15 Case-only folder rename blocked
- **Prompt:** Rename `Backend` to `backend` per the plan (`mv Backend backend_tmp && mv backend_tmp backend`).
- **AI output:** The planned two-step `mv` failed with "Device or resource busy"; `Rename-Item` failed likewise. A scan of process working directories found OpenAI Codex desktop helper processes (node.exe / node_repl.exe) with their cwd inside `Backend\`.
- **Correction:** Asked the user instead of killing processes; the user closed Codex themselves, after which the rename succeeded. The empty `frontend/` folder was recreated by remove + mkdir because it was empty.
- **Decision:** User chose to close Codex rather than have processes killed.

## 2026-10-15 .gitattributes added
- **Prompt:** (Not in the plan.) Git emitted CRLF warnings on Windows during Task 1.
- **AI output:** Added `.gitattributes` with `* text=auto eol=lf` so Dockerfile and shell scripts stay LF for Linux CI.
- **Correction:** None needed; this was an addition beyond the plan.
- **Decision:** Kept as a small addition.

## 2026-10-15 Task 1 run inline; Docker daemon
- **Prompt:** Execute Task 1 of the plan.
- **AI output:** The AI executed Task 1 itself rather than via a subagent, because the subagent workflow's ledger needs the git repo that Task 1 creates. The Docker daemon was not running at the start.
- **Correction:** The user started Docker Desktop before the Mongo-dependent tasks.
- **Decision:** Task 1 inline; Docker started by the user ahead of Mongo-dependent work.
