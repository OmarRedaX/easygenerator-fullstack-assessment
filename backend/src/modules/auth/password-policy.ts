export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const LETTER_RE = /[A-Za-z]/;
export const DIGIT_RE = /[0-9]/;
// ASCII punctuation/symbols: 0x21-0x2F, 0x3A-0x40, 0x5B-0x60, 0x7B-0x7E. A space is NOT special.
export const SPECIAL_RE = /[!-/:-@[-`{-~]/;

export const PASSWORD_MESSAGES = {
  length: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
  letter: 'Password must contain at least one letter',
  digit: 'Password must contain at least one number',
  special: 'Password must contain at least one special character',
} as const;

export function validatePassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) problems.push(PASSWORD_MESSAGES.length);
  if (!LETTER_RE.test(password)) problems.push(PASSWORD_MESSAGES.letter);
  if (!DIGIT_RE.test(password)) problems.push(PASSWORD_MESSAGES.digit);
  if (!SPECIAL_RE.test(password)) problems.push(PASSWORD_MESSAGES.special);
  return problems;
}
