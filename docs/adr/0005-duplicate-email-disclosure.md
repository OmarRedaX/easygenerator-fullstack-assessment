# ADR 0005 — Signup discloses duplicate emails

Status: accepted (2026-10-15)

## Context
A signup endpoint that answers "email already registered" lets a caller test whether an address has an account
(account enumeration). Hiding it needs an email-confirmation flow that is out of scope for this assessment.

## Decision
- The unique index on `email` is the real guard. Mongo `E11000` is translated in the repository to
  `DuplicateEmailError`, mapped to `409 Email already registered`.
- Signin stays generic (`401 Invalid email or password`) for both unknown email and wrong password.
- Enumeration through signup is mitigated by the strict rate limit on signup and signin (10/min/IP by default).

## Consequences
- The trade-off is accepted and documented. An attacker can still enumerate slowly within the rate limit.
- A production system would move to a confirmation-email flow that answers identically for existing and new
  addresses.
