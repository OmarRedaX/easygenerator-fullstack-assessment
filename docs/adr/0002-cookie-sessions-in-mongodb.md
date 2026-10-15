# ADR 0002 — Cookie sessions stored in MongoDB

Status: accepted (2026-10-15)

## Context
The AI first recommended a short-lived access JWT plus a rotating refresh token. The project owner rejected that
and chose server-side cookie sessions (see `docs/AI-LOG.md`, "Session mechanism").

## Decision
- `express-session` with `connect-mongo`. Cookie: `httpOnly`, `SameSite=Lax`, `Secure` in production, explicit
  name, 7-day `maxAge`.
- Session data is exactly `userId` and `absoluteExpiresAt` (now + 7 days, set when the authenticated session is
  created).
- `SessionGuard` verifies `absoluteExpiresAt` on every protected request; if expired it destroys the session,
  clears the cookie and returns 401. `cookie.maxAge`, `touchAfter` and the Mongo TTL index are housekeeping only
  and are never the enforcement.
- The session ID is regenerated on signin and signup; logout destroys the server-side session.

## Consequences
- Sessions can be revoked immediately (logout, deleted user) because state lives on the server.
- One database round-trip per protected request, accepted for the simplicity and revocability.
- Requires CSRF protection (ADR 0003) because the browser sends the cookie automatically.
