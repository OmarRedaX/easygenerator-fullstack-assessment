// Mirrors the password rules of contracts/openapi.yaml (SignUpRequest.password). The contract test in
// contract-mirror.test.ts fails if these drift. A space is not a special character; Unicode is allowed in a
// password but satisfies no class.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** The contract's pattern, verbatim. */
export const PASSWORD_PATTERN = '^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!-/:-@\\[-`{-~]).{8,128}$';

export interface PasswordRules {
  length: boolean;
  letter: boolean;
  digit: boolean;
  special: boolean;
}

export function evaluatePassword(value: string): PasswordRules {
  return {
    length: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    letter: /[A-Za-z]/.test(value),
    digit: /[0-9]/.test(value),
    special: /[!-/:-@[-`{-~]/.test(value),
  };
}

export function isPasswordValid(value: string): boolean {
  const rules = evaluatePassword(value);
  return rules.length && rules.letter && rules.digit && rules.special;
}
