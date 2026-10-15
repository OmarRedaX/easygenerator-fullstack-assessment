# Contract: Routes and guards

Router: declarative `BrowserRouter` (tests use `MemoryRouter`). One `<Routes>` tree under the providers.

| Path | Guard | Page | Title (`document.title`) |
|---|---|---|---|
| `/` | `RequireAuth` | `WelcomePage` | `Easygenerator` |
| `/signin` | `GuestOnly` | `SignInPage` | `Sign in - Easygenerator` |
| `/signup` | `GuestOnly` | `SignUpPage` | `Create account - Easygenerator` |
| `*` | none | `<Navigate to="/" replace />` (then the guard decides) | - |

## Guard behaviour (session = `['me']`, see `data-model.md`)

| Session | `RequireAuth` | `GuestOnly` |
|---|---|---|
| pending | splash | splash |
| error (non-401) | splash error + Retry (`refetch`) | splash error + Retry |
| `null` | `<Navigate to="/signin" replace state={{ from }} />` | render the page |
| `User` | render the page | `<Navigate to="/" replace />` |

- `from` = `location.pathname + location.search`. After a successful sign-in or sign-up the page navigates to
  `from` when it is a safe internal path (starts with exactly one `/`, not `//`, not `/signin`, not `/signup`),
  otherwise to `/`, always with `replace: true`.
- Navigation after auth uses `replace`, so Back never returns to a sign-in form with a live session and never
  reveals protected content after sign-out (FR-014, edge case "back button").
- The splash is a centred logo mark with a visually hidden "Loading" status (`role="status"`); no skeletons.

## Page contracts

### SignUpPage / SignInPage
Centred card (dissolves into the page under 480px). Contents, in order: logo mark, `h1`, one-line subtitle,
optional form alert (`role="alert"`), fields, primary button, switch link. Fields are listed in `spec.md` FR-001/002.
`autocomplete`: `name`, `email`, `new-password` (sign-up) / `current-password` (sign-in). Enter submits. While
submitting: inputs `disabled`, button `aria-busy="true"` with spinner and the label "Creating account..." /
"Signing in...", the form ignores further submits. Heading `h1` text: "Create your account" / "Sign in".

### WelcomePage
Translucent top bar (brand + "Sign out" ghost button), then a centred block: email pill, `h1` exactly
`Welcome to the application.`, one sentence of supporting copy. "Sign out" shows "Signing out..." with `aria-busy`
while pending; on a non-401 failure a page-level `Alert` (with reference when present) appears above the headline.
