import { ApiError } from '../../lib/api/errors';

// User-facing copy and status handling from specs/001-frontend-auth/contracts/api-usage.md.
export type FormContext = 'signin' | 'signup' | 'logout';
export type FormField = 'email' | 'name' | 'password';

export interface FormFeedback {
  /** Shown in the alert above the form (or the page). */
  message?: string;
  /** Present only when the server supplied one; network and client-side errors never have it. */
  requestId?: string;
  fieldErrors: Partial<Record<FormField, string>>;
}

const KNOWN_FIELDS: readonly string[] = ['email', 'name', 'password'];

const MESSAGES = {
  invalidCredentials: 'Invalid email or password.',
  duplicateEmail: 'That email is already registered.',
  blocked: 'This request was blocked. Reload the page and try again.',
  tooMany: 'Too many attempts. Try again in a minute.',
  generic: 'Something went wrong. Try again.',
  logoutFailed: "Couldn't sign you out. Try again.",
} as const;

function isKnownField(field: string): field is FormField {
  return KNOWN_FIELDS.includes(field);
}

function fromBadRequest(error: ApiError): Pick<FormFeedback, 'message' | 'fieldErrors'> {
  const fieldErrors: FormFeedback['fieldErrors'] = {};
  const leftovers: string[] = [];
  for (const detail of error.details ?? []) {
    const first = detail.messages[0];
    if (first === undefined) continue;
    if (isKnownField(detail.field)) fieldErrors[detail.field] ??= first;
    else leftovers.push(`${detail.field}: ${first}`);
  }
  if (leftovers.length > 0) return { message: leftovers.join(' '), fieldErrors };
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { message: error.message, fieldErrors };
}

function fromStatus(error: ApiError, context: FormContext): Pick<FormFeedback, 'message' | 'fieldErrors'> {
  switch (error.status) {
    case 400:
      return fromBadRequest(error);
    case 401:
      return context === 'signin'
        ? { message: MESSAGES.invalidCredentials, fieldErrors: {} }
        : { message: MESSAGES.generic, fieldErrors: {} };
    case 403:
      return { message: MESSAGES.blocked, fieldErrors: {} };
    case 409:
      return context === 'signup'
        ? { fieldErrors: { email: MESSAGES.duplicateEmail } }
        : { message: MESSAGES.generic, fieldErrors: {} };
    case 413:
      return { message: error.message, fieldErrors: {} };
    case 429:
      return { message: MESSAGES.tooMany, fieldErrors: {} };
    default:
      // 5xx and anything unexpected: never show the server's text.
      return { message: MESSAGES.generic, fieldErrors: {} };
  }
}

export function toFormFeedback(error: unknown, context: FormContext): FormFeedback {
  if (!(error instanceof ApiError)) {
    return {
      message: context === 'logout' ? MESSAGES.logoutFailed : MESSAGES.generic,
      fieldErrors: {},
    };
  }
  const reference = error.requestId ? { requestId: error.requestId } : {};
  if (context === 'logout') return { message: MESSAGES.logoutFailed, ...reference, fieldErrors: {} };
  return { ...fromStatus(error, context), ...reference };
}
