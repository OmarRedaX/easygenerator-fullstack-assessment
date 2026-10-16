# Contract: API usage (consumer side)

Source of truth is `contracts/openapi.yaml`; this file only records how the frontend uses it. Base path: `/api`
on the page's own origin (`fetch(url, { credentials: 'same-origin' })`).

## Operations used

| operationId | Call | Request | Success | Used by |
|---|---|---|---|---|
| `signUp` | `POST /api/auth/signup` | JSON `{ email, name, password }`, `Content-Type: application/json` | `201 { user }` | `SignUpPage` |
| `signIn` | `POST /api/auth/signin` | JSON `{ email, password }` | `200 { user }` | `SignInPage` |
| `logout` | `POST /api/auth/logout` | no body, no content type | `204` | `WelcomePage` |
| `getMe` | `GET /api/auth/me` | none | `200 { user }` | session bootstrap |

`getHealth` is not used by the UI. The browser adds `Origin` automatically on every POST; the client never sets
`Origin`, `Cookie` or CSRF headers itself. The client never sends `X-Request-Id`.

## Client behaviour

- JSON in and out; `204` resolves `undefined`.
- Every non-2xx -> `ApiError` (see `data-model.md`); a rejected `fetch` -> `NetworkError`.
- Requests have no automatic retry. `getMe` is configured with `retry: false`.
- A 401 from any operation other than `signIn`, `signUp` and `getMe` triggers the registered `onUnauthorized`
  callback (sets `['me']` to `null`).

## Status handling

| Status | Operations | Handling | User-visible text |
|---|---|---|---|
| 200 / 201 | all but logout | cancel `['me']`, set `['me']`, navigate | - |
| 204 | logout | set `['me']` to `null`, go to `/signin` | - |
| 400 with `details` | signUp, signIn | per-field `setError`; unknown field -> form alert; focus first invalid field | the server's field messages |
| 400 without `details`, 413 | any | form alert | the server's `message` |
| 401 | signIn | form alert, fields keep values, password field focused | `Invalid email or password.` |
| 401 | logout | same as success | - |
| 401 | getMe | normal result: `null` | - |
| 401 | other | `onUnauthorized` -> `null` -> guard redirects | - |
| 403 | any | form alert (or logout error) | `This request was blocked. Reload the page and try again.` |
| 409 | signUp | `setError('email')`, focus email | `That email is already registered.` |
| 429 | any | form alert | `Too many attempts. Try again in a minute.` |
| 5xx, other 4xx | any | form alert | `Something went wrong. Try again.` |
| `NetworkError` | any | form alert, values kept | `Something went wrong. Try again.` |
| non-401 failure | logout | page-level alert, stay on `/`, `invalidateQueries(['me'])` | `Couldn't sign you out. Try again.` |
| non-401 failure | getMe | splash error state with Retry | `Couldn't reach the server.` |

"Reference <requestId>" is appended to any alert above **iff** `ApiError.requestId` is defined. `NetworkError` and
client-side validation errors never show one.

## Mirrored validation (must equal the contract)

- `email`: `format: email`, `maxLength: 254`.
- `name`: `minLength: 3`, `maxLength: 80`.
- `password`: `minLength: 8`, `maxLength: 128`, pattern `^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\[-`{-~]).{8,128}$`.

A unit test reads `contracts/openapi.yaml` as plain text (`fs.readFileSync`, no YAML dependency), extracts the
`pattern:`, `minLength`/`maxLength` values of `SignUpRequest` with a regex, and asserts they equal the constants in
`password-policy.ts` and `schemas.ts`, so a contract edit that is not mirrored fails CI.
