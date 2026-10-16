# Data Model: Frontend Auth Module

The frontend owns no persistent data. Everything below is in-memory client state or a wire shape defined by
`contracts/openapi.yaml`. Field names and limits are the contract's; do not re-derive them.

## Wire entities (from the contract)

### User
| Field | Type | Notes |
|---|---|---|
| `id` | string | Opaque. |
| `email` | string | Lowercase, as stored by the server. |
| `name` | string | Trimmed by the server. |
| `createdAt` | string (ISO date-time) | Not displayed in this feature. |

`UserEnvelope = { user: User }` is the body of 200/201 from sign-in, sign-up and `GET /auth/me`.

### ApiErrorBody
`{ statusCode: number, error: string, message: string, requestId: string, details?: { field: string, messages:
string[] }[] }`. Parsed defensively: any missing property degrades to a generic error (see `ApiError`).

## Client types

### SignUpInput / SignInInput
| Type | Field | Rule (client) |
|---|---|---|
| SignUpInput | `email` | trim -> lowercase -> valid email -> max 254 |
| | `name` | trim -> 3..80 characters |
| | `password` | 8..128 characters; at least one `[A-Za-z]`, one `[0-9]`, one char of ``!"#$%&'()*+,-./:;<=>?@[\]^_`{\|}~``; spaces/Unicode allowed but count toward no class; **never trimmed** |
| SignInInput | `email` | trim -> lowercase -> non-empty -> valid email -> max 254 |
| | `password` | non-empty (policy is not re-applied) |

Password rule results (drive both the schema and the checklist from one function):
`PasswordRules = { length: boolean, letter: boolean, digit: boolean, special: boolean }`, computed by
`evaluatePassword(value)`; `isPasswordValid = every rule true`. The special-character regex is the contract's
`[!-/:-@\[-`{-~]`.

### ApiError
`class ApiError extends Error { status: number; details?: FieldDetail[]; requestId?: string }`.
- Built from a non-2xx response. `requestId` comes from the body, falling back to the `X-Request-Id` response
  header; it is `undefined` when neither exists.
- A body that is empty, not JSON, or lacks `message` yields `message: 'Request failed'` and keeps `status`.

### NetworkError
`class NetworkError extends Error` - the `fetch` promise rejected (offline, DNS, aborted). No `status`, **no
`requestId`**.

### FieldDetail
`{ field: string, messages: string[] }` - applied to a form field when `field` is a known form key; otherwise
shown in the form alert.

### FormFeedback (UI-only)
`{ message: string, requestId?: string } | null` - the single alert above a form. `requestId` is rendered as
"Reference <id>" iff defined.

## Session state (TanStack Query cache, key `['me']`)

| Cache value | Meaning | Rendered as |
|---|---|---|
| query `pending` | first check in flight | the splash, on every route (guarded and guest-only), so no form or protected content flashes |
| `User` | signed in | protected routes allowed |
| `null` | signed out (including a 401 from `GET /auth/me`) | redirect to `/signin` |
| query `error` (non-401) | server/network failure while checking | "Couldn't reach the server." + Retry |

### Transitions
```
              getMe -> 200                              sign-in / sign-up success
  pending ───────────────────────► User ◄───────────────────────────────────── null
     │  getMe -> 401                  │   ▲                                        ▲
     ├────────────────────────────────┼───┼──── (cancelQueries, then setQueryData) │
     │  getMe -> other failure        │   │ logout failed (not 401): invalidate ['me'] -> re-check
     ▼                                │   │
   error ──Retry──► pending           │   └────────────────────────────────────────┘
                                      │  logout success | logout 401 | any protected 401
                                      └──────────────────────► null
```
Invariant: `setQueryData(['me'], user)` after sign-in/sign-up is always preceded by
`await queryClient.cancelQueries({ queryKey: ['me'] })`, so a late response from an older `getMe` is dropped.

## Not stored anywhere
Passwords (kept only in the form's input until submit), the session cookie (`httpOnly`, unreadable), tokens
(none exist), and the `User` beyond the in-memory query cache. Nothing is written to `localStorage`,
`sessionStorage`, IndexedDB, cookies set by script, or URLs (enforced by lint, FR-017).
