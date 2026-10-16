import { describe, expect, it } from 'vitest';
import { signInSchema, signUpSchema } from './schemas';

const valid = { email: 'ada@example.com', name: 'Ada', password: 'Abcdef1!' };

interface Parsed {
  success: boolean;
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}

function firstMessage(result: Parsed, field: string) {
  return result.error?.issues.find((i) => i.path[0] === field)?.message;
}

describe('signUpSchema', () => {
  it('accepts valid input', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('trims and lowercases email', () => {
    const r = signUpSchema.parse({ ...valid, email: '  Ada@Example.COM ' });
    expect(r.email).toBe('ada@example.com');
  });

  it('rejects an invalid email format with a specific message', () => {
    expect(firstMessage(signUpSchema.safeParse({ ...valid, email: 'ada@example' }), 'email')).toBe(
      'Enter a valid email address, like name@example.com.',
    );
  });

  it('enforces email max length 254', () => {
    // Realistic shape: 64-char local part and DNS labels of at most 63 characters.
    const labels = `${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.`;
    const make = (total: number) => `${'a'.repeat(64)}@${labels}${'e'.repeat(total - 65 - labels.length)}`;
    expect(make(254)).toHaveLength(254);
    expect(signUpSchema.safeParse({ ...valid, email: make(254) }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, email: make(255) }).success).toBe(false);
  });

  it('requires a name of 3 to 80 characters after trimming', () => {
    expect(firstMessage(signUpSchema.safeParse({ ...valid, name: 'Al' }), 'name')).toBe(
      'Name must be at least 3 characters.',
    );
    expect(signUpSchema.parse({ ...valid, name: '  Ada ' }).name).toBe('Ada');
    expect(signUpSchema.safeParse({ ...valid, name: '  Al  ' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, name: 'a'.repeat(80) }).success).toBe(true);
    expect(firstMessage(signUpSchema.safeParse({ ...valid, name: 'a'.repeat(81) }), 'name')).toBe(
      'Name must be at most 80 characters.',
    );
  });

  it('validates password length and classes and never trims it', () => {
    expect(firstMessage(signUpSchema.safeParse({ ...valid, password: 'Ab1!' }), 'password')).toBe(
      'Password must be at least 8 characters.',
    );
    expect(firstMessage(signUpSchema.safeParse({ ...valid, password: `Ab1!${'a'.repeat(125)}` }), 'password')).toBe(
      'Password must be at most 128 characters.',
    );
    expect(firstMessage(signUpSchema.safeParse({ ...valid, password: 'abcdefgh' }), 'password')).toBe(
      'Password needs a letter, a number and a symbol.',
    );
    expect(signUpSchema.parse({ ...valid, password: '  Abcdef1!  ' }).password).toBe('  Abcdef1!  ');
  });
});

describe('signInSchema', () => {
  it('requires an email and a password only', () => {
    expect(firstMessage(signInSchema.safeParse({ email: '', password: 'x' }), 'email')).toBe('Enter your email.');
    expect(firstMessage(signInSchema.safeParse({ email: 'a@b.co', password: '' }), 'password')).toBe(
      'Enter your password.',
    );
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('still validates the email format and length', () => {
    expect(firstMessage(signInSchema.safeParse({ email: 'nope', password: 'x' }), 'email')).toBe(
      'Enter a valid email address, like name@example.com.',
    );
    expect(signInSchema.parse({ email: ' A@B.CO ', password: 'x' }).email).toBe('a@b.co');
  });
});
