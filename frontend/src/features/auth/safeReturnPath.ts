const GUEST_PATHS = new Set(['/signin', '/signup']);

/**
 * Where to go after signing in. Only an internal absolute path is accepted (starts with a single "/", not "//"
 * or a slash followed by a backslash), and never the sign-in or sign-up pages; anything else falls back to "/".
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  const pathname = value.split(/[?#]/, 1)[0] ?? '/';
  return GUEST_PATHS.has(pathname) ? '/' : value;
}
