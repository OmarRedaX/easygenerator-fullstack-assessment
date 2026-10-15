---
name: auth-session-security
description: Rules for sessions, cookies, CSRF and password hashing in this repo. Use when touching auth, session, guard or hashing code.
---
- Session data = `userId` + `absoluteExpiresAt` only. Enforce expiry in SessionGuard on every protected request (destroy, clear cookie, 401).
- Regenerate the session ID on signin/signup. Cookie: httpOnly, SameSite=Lax, Secure in production.
- CSRF guard fails closed: Origin → Referer → 403; reject `Origin: null` and `Sec-Fetch-Site: cross-site`.
- argon2id floor 19456 KiB / 2 / 1. Signin errors are one generic 401. Never log passwords or cookies.
