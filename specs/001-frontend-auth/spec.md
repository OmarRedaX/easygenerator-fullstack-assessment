# Feature Specification: Frontend Auth Module

**Feature Branch**: `feat/frontend-auth` (working branch chosen by the owner; independent of this directory name)

**Created**: 2026-10-16

**Status**: Implemented (see tasks.md and docs/reviews/2026-10-16-frontend-review.md)

**Input**: User description: "Frontend auth module for the Easygenerator assessment: React + TypeScript sign-up, sign-in and application pages against the existing cookie-session backend, with an Apple-inspired interface. Source of truth for scope, rules and behaviour: docs/superpowers/specs/2026-10-16-frontend-design.md (sections 1-8) and contracts/openapi.yaml."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account (Priority: P1)

A new visitor opens the app, fills in a sign-up form with email, name and password, and ends up signed in on the
application page. While typing a password they see, live, which requirements are met.

**Why this priority**: Without account creation nothing else is reachable; it is the first step of the assessment
and the largest block of validation and error handling.

**Independent Test**: With the backend running, open the sign-up page, submit valid details, and confirm the
visitor lands on the application page signed in. Submit a duplicate email and confirm a clear message on the email
field.

**Acceptance Scenarios**:

1. **Given** a visitor who is signed out, **When** they submit a valid email, a name of at least 3 characters and
   a password meeting all rules, **Then** the account is created, they are signed in, and the application page is
   shown.
2. **Given** the sign-up form, **When** the visitor types a password, **Then** a checklist shows in real time
   whether it has 8+ characters, a letter, a number and a special character.
3. **Given** a field the visitor has left, **When** its value is invalid (email format, name under 3 characters,
   password rules), **Then** a specific message appears next to that field, and not before they have left it.
4. **Given** an email that is already registered, **When** the visitor submits, **Then** the email field shows
   "That email is already registered." and the other entries are kept.
5. **Given** a submission the server rejects with per-field messages, **When** the response arrives, **Then** each
   message appears on its matching field and focus moves to the first invalid field.
6. **Given** a submission in progress, **When** the visitor waits, **Then** the form is locked, the button shows
   progress, and the visitor cannot submit twice.

---

### User Story 2 - Sign in and see the application page (Priority: P1)

A returning visitor signs in with email and password and sees the page that says "Welcome to the application."
along with who they are signed in as.

**Why this priority**: Sign-in plus the protected page is the core promise of the module and proves the session
works end to end.

**Independent Test**: With an existing account, sign in and confirm the welcome page shows the message and the
account's email. Enter a wrong password and confirm a single generic error banner.

**Acceptance Scenarios**:

1. **Given** an existing account, **When** the visitor submits the correct email and password, **Then** the
   application page shows "Welcome to the application." and the signed-in email.
2. **Given** an unknown email or a wrong password, **When** the visitor submits, **Then** the same message
   "Invalid email or password." is shown for both cases, with a request reference when the server supplied one.
3. **Given** a submission in progress, **When** the visitor waits, **Then** the inputs are locked and the button
   shows progress without changing its label width.
4. **Given** too many attempts, **When** the server refuses further requests, **Then** the visitor sees "Too many
   attempts. Try again in a minute."
5. **Given** the server cannot be reached or fails unexpectedly, **When** the visitor submits, **Then** a calm
   "Something went wrong. Try again." message is shown, with no technical details.

---

### User Story 3 - Stay signed in, be guarded, and sign out (Priority: P2)

A signed-in visitor who reloads the page stays signed in. A signed-out visitor who tries to open the application
page is sent to sign-in. A signed-in visitor can sign out and is returned to sign-in.

**Why this priority**: Session continuity and route protection make the module production-credible, but they build
on stories 1 and 2.

**Independent Test**: Sign in, reload the application page and remain signed in; sign out and confirm the
application page is no longer reachable; open the application page while signed out and confirm redirection.

**Acceptance Scenarios**:

1. **Given** a signed-in visitor, **When** they reload the application page, **Then** they remain signed in.
2. **Given** a signed-out visitor, **When** they open the application page directly, **Then** they are sent to
   sign-in, and after signing in they return to where they were going.
3. **Given** a signed-in visitor, **When** they open the sign-in or sign-up page, **Then** they are sent to the
   application page.
4. **Given** a signed-in visitor, **When** they choose "Sign out" and the server confirms (or reports the session
   is already gone), **Then** they are returned to sign-in and cannot reach the application page.
5. **Given** a sign-out that fails for another reason, **When** the failure is reported, **Then** an error is shown,
   the visitor stays on the application page, and their real session state is rechecked.
6. **Given** a session that expires while the visitor is using the app, **When** the next protected request is
   refused, **Then** the visitor is sent to sign-in.
7. **Given** a sign-in or sign-up that completes while an earlier "who am I" check is still pending, **When** that
   earlier check later reports "not signed in", **Then** the new session is not discarded.

---

### User Story 4 - A polished, accessible experience on any device (Priority: P2)

Every page looks and feels consistent, premium and calm: clear typography, balanced spacing, subtle motion,
light and dark appearance following the device setting, and a usable layout from small phones to desktop. The
whole flow works with a keyboard and assistive technology.

**Why this priority**: The assignment grades design quality and production-readiness; this story is the shared
visual and accessibility standard for the other three.

**Independent Test**: Walk the three pages and all error/loading states at 320px, 375px and desktop widths, in
light and dark appearance, with keyboard only, and with reduced-motion enabled.

**Acceptance Scenarios**:

1. **Given** any page, **When** viewed at widths from 320px up, **Then** nothing overflows horizontally and all
   controls remain at least 44px tall to tap.
2. **Given** the device is set to dark appearance, **When** the app loads, **Then** all pages use the dark
   palette; likewise for light.
3. **Given** a keyboard-only visitor, **When** they tab through a form, **Then** every control shows a visible
   focus indicator, order is logical, and the form submits with the Enter key.
4. **Given** a visitor who prefers reduced motion or transparency, **When** pages animate or use translucent
   layers, **Then** animations are minimal and translucent layers become solid.
5. **Given** a screen reader, **When** a field is invalid, **Then** its label, state and error message are
   announced together, and server errors are announced when they appear.

### Edge Cases

- Name or password with leading/trailing spaces: name is trimmed for validation; passwords are never trimmed.
- Password of exactly 7, 8, 128 and 129 characters; a password whose only "special" character is a space (it does
  not count); passwords containing non-ASCII characters (allowed, but they satisfy no character class).
- Email in mixed case or with surrounding spaces is accepted and normalised; an email over 254 characters is
  rejected.
- A server error for a field the form does not have is shown as a form-level message rather than lost.
- An empty or unreadable error response from the server still yields a calm generic message.
- Network loss during submit leaves the entered values intact and re-enables the form.
- Double-clicking or pressing Enter repeatedly sends only one request.
- Opening an unknown address sends the visitor to the application page (or to sign-in if signed out).
- Browser back button after signing out does not reveal protected content.
- Very long names or emails wrap or truncate without breaking the layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a sign-up page with email, name and password fields and a clear way to
  switch to sign-in.
- **FR-002**: The system MUST provide a sign-in page with email and password fields and a clear way to switch to
  sign-up.
- **FR-003**: The system MUST provide an application page that displays exactly "Welcome to the application." and
  the signed-in user's email, with a "Sign out" control.
- **FR-004**: Sign-up MUST validate email format and length (max 254), name length (3 to 80 after trimming) and
  password (8 to 128 characters containing at least one letter, one number and one special character from the
  ASCII punctuation set; a space is not special), using the same rules as the backend contract.
- **FR-005**: Sign-in MUST check only that email and password are present; it MUST NOT re-apply the password
  policy.
- **FR-006**: Validation messages MUST appear after a field is left and then update live, be specific to the rule
  broken, and never rely on colour alone.
- **FR-007**: The sign-up page MUST show a live checklist of the password requirements.
- **FR-008**: On a failed submit, focus MUST move to the first invalid field.
- **FR-009**: The system MUST translate server outcomes into user messages: per-field errors on their fields; a
  generic "Invalid email or password." for failed sign-in; "That email is already registered." on the email field
  for duplicates; a rate-limit message; and a generic message for blocked, server and network failures.
- **FR-010**: A request reference MUST be shown with an error if and only if the server supplied one; network
  failures and client-side validation errors MUST show none.
- **FR-011**: While a request is in flight, the form MUST be locked, show progress, and prevent duplicate
  submissions.
- **FR-012**: On startup the system MUST determine whether the visitor is signed in; "not signed in" MUST be
  treated as a normal result, not an error, and MUST NOT be retried.
- **FR-013**: When sign-in or sign-up completes, the system MUST cancel any pending sign-in-state check before
  recording the new session, so a stale "not signed in" result cannot overwrite it.
- **FR-014**: Signed-out visitors MUST be redirected from the application page to sign-in and returned to their
  intended destination after signing in; signed-in visitors MUST be redirected away from sign-in and sign-up.
- **FR-015**: Sign-out MUST end the session and return the visitor to sign-in when the server confirms or reports
  the session already gone; for any other failure it MUST show the error, keep the visitor on the page, and
  recheck session state.
- **FR-016**: If a protected request reports that the session is no longer valid, the visitor MUST be returned
  to sign-in.
- **FR-017**: The system MUST NOT store credentials, session identifiers or user data in the browser's persistent
  storage, in URLs, or in logs.
- **FR-018**: All pages MUST follow one visual system (typography, spacing, colours, controls, motion) supporting
  light and dark appearance from the device setting and layouts from 320px wide upward.
- **FR-019**: Every control MUST have an accessible label, a visible focus state, and a minimum 44px touch
  target; text contrast MUST be at least 4.5:1 in both appearances.
- **FR-020**: Motion MUST be subtle, give immediate feedback to presses, and be reduced or removed when the
  visitor prefers reduced motion; translucent layers MUST become solid when reduced transparency is preferred.
- **FR-021**: Each page MUST have a distinct, descriptive title.
- **FR-022**: The frontend MUST be buildable and testable in CI alongside the backend (install, lint, type check,
  tests, production build) and MUST be packageable as a container image for same-origin hosting with the backend.

### Key Entities

- **User**: the signed-in person, as the server reports them: an identifier, email, name and creation time. The
  password is never returned or retained.
- **Session**: the server-held login state referenced by a cookie the page cannot read. The frontend only learns
  whether a session exists (and for whom) by asking the server.
- **Server error**: a status, message, optional per-field messages, and an optional request reference. It is the
  only error shape the interface has to interpret.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can go from the sign-up page to the application page in under 60 seconds on a first
  attempt with valid input.
- **SC-002**: A returning visitor can sign in and reach the application page in under 15 seconds.
- **SC-003**: 100% of the server outcomes listed in FR-009 produce the specified message in automated tests, and
  none exposes technical details or stack traces.
- **SC-004**: Password rule boundaries (7, 8, 128, 129 characters; each missing class; a space) produce the same
  accept/reject result as the backend contract in 100% of test cases.
- **SC-005**: After sign-out, session expiry, or a stale sign-in-state check, the visitor never sees protected
  content while signed out and never loses a valid new session (verified by automated tests).
- **SC-006**: All three pages and every error/loading state pass an automated accessibility check with zero
  serious or critical violations, and the flows are completable by keyboard alone.
- **SC-007**: Pages render without horizontal scrolling at widths from 320px to 1920px in both appearances.
- **SC-008**: The CI frontend job passes on a clean checkout, and automated test coverage of the data and
  feature logic is at least 80%.
- **SC-009**: A reviewer can run the app locally against the backend in under 5 minutes following the README.

## Assumptions

- The backend is finished, merged and unchanged; this feature consumes its published contract
  (`contracts/openapi.yaml`) and requires no backend changes. If one is needed it becomes a separate issue.
- The backend and frontend are served from the same site, so the browser sends the session cookie automatically
  and only same-site hosting is supported.
- Visitors use a current evergreen browser with JavaScript enabled.
- Appearance (light or dark) follows the device setting; there is no in-app theme switch.
- Out of scope: password reset, email verification, profile editing, multiple languages, social sign-in,
  end-to-end browser tests, and cross-site hosting.
- Technical choices (framework, libraries, structure, hosting configuration) are decided in the plan, taken from
  `docs/superpowers/specs/2026-10-16-frontend-design.md` and the constitution at `.specify/memory/constitution.md`.
- The approved visual direction is the mockup reviewed during the brainstorm, expressed through the design tokens
  in section 7 of the design document.
