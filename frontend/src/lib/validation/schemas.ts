import { z } from 'zod';
import { evaluatePassword, PASSWORD_MAX, PASSWORD_MIN } from './password-policy';

// Limits mirror contracts/openapi.yaml; contract-mirror.test.ts fails if they drift.
export const EMAIL_MAX = 254;
export const NAME_MIN = 3;
export const NAME_MAX = 80;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email.')
  .max(EMAIL_MAX, `Email must be at most ${String(EMAIL_MAX)} characters.`)
  .pipe(z.email('Enter a valid email address, like name@example.com.'));

export const signUpSchema = z.object({
  email: emailField,
  name: z
    .string()
    .trim()
    .min(NAME_MIN, `Name must be at least ${String(NAME_MIN)} characters.`)
    .max(NAME_MAX, `Name must be at most ${String(NAME_MAX)} characters.`),
  // Passwords are never trimmed: leading and trailing spaces are part of the secret.
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${String(PASSWORD_MIN)} characters.`)
    .max(PASSWORD_MAX, `Password must be at most ${String(PASSWORD_MAX)} characters.`)
    .refine(
      (value) => {
        const rules = evaluatePassword(value);
        return rules.letter && rules.digit && rules.special;
      },
      'Password needs a letter, a number and a symbol.',
    ),
});

// Sign-in checks presence only: the password policy is not re-applied to existing accounts.
export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
});

export type SignUpValues = z.input<typeof signUpSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type SignInValues = z.input<typeof signInSchema>;
export type SignInInput = z.output<typeof signInSchema>;
