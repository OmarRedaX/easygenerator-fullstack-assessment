import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX, PASSWORD_MIN, PASSWORD_PATTERN } from './password-policy';
import { EMAIL_MAX, NAME_MAX, NAME_MIN } from './schemas';

// Tests run with the frontend workspace as cwd (npm -w frontend / vitest root).
const contract = readFileSync(resolve(process.cwd(), '../contracts/openapi.yaml'), 'utf8');
const signUpBlock = /^ {4}SignUpRequest:\n([\s\S]*?)^ {4}SignInRequest:/m.exec(contract)?.[1] ?? '';

function propertyBlock(name: string): string {
  return new RegExp(`^ {8}${name}:([\\s\\S]*?)(?=^ {8}\\w+:|(?![\\s\\S]))`, 'm').exec(signUpBlock)?.[1] ?? '';
}
const num = (block: string, key: string) => Number(new RegExp(`${key}: (\\d+)`).exec(block)?.[1]);

describe('validation constants mirror contracts/openapi.yaml (SignUpRequest)', () => {
  it('found the contract section', () => {
    expect(signUpBlock).toContain('required: [email, name, password]');
  });

  it('email', () => {
    expect(EMAIL_MAX).toBe(num(propertyBlock('email'), 'maxLength'));
  });

  it('name', () => {
    const block = propertyBlock('name');
    expect(NAME_MIN).toBe(num(block, 'minLength'));
    expect(NAME_MAX).toBe(num(block, 'maxLength'));
  });

  it('password', () => {
    const block = propertyBlock('password');
    expect(PASSWORD_MIN).toBe(num(block, 'minLength'));
    expect(PASSWORD_MAX).toBe(num(block, 'maxLength'));
    const pattern = /pattern: '(.*)'/.exec(block)?.[1];
    expect(PASSWORD_PATTERN).toBe(pattern);
  });
});
