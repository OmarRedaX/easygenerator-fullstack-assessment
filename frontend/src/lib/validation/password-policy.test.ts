import { describe, expect, it } from 'vitest';
import { evaluatePassword, isPasswordValid } from './password-policy';

const pad = (base: string, length: number) => base + 'a'.repeat(Math.max(0, length - base.length));

describe('evaluatePassword', () => {
  it('reports each rule independently', () => {
    expect(evaluatePassword('abcdefgh1')).toEqual({ length: true, letter: true, digit: true, special: false });
    expect(evaluatePassword('')).toEqual({ length: false, letter: false, digit: false, special: false });
    expect(evaluatePassword('12345678!')).toEqual({ length: true, letter: false, digit: true, special: true });
  });
});

describe('isPasswordValid', () => {
  it.each([
    [7, false],
    [8, true],
    [128, true],
    [129, false],
  ])('length %i valid=%s (boundaries)', (length, expected) => {
    expect(isPasswordValid(pad('Aa1!', length))).toBe(expected);
  });

  it.each([
    ['no letter', '12345678!', false],
    ['no digit', 'Abcdefgh!', false],
    ['no special', 'Abcdefg1', false],
    ['all classes', 'Abcdef1!', true],
  ])('%s', (_name, value, expected) => {
    expect(isPasswordValid(value)).toBe(expected);
  });

  it('does not count a space as special', () => {
    expect(isPasswordValid('Abcdef1 ')).toBe(false);
    expect(isPasswordValid('Abcdef 1')).toBe(false);
    expect(evaluatePassword('Abcdef 1').special).toBe(false);
  });

  it('allows Unicode and spaces but they satisfy no class', () => {
    expect(evaluatePassword('ÄÖÜÄÖÜ12')).toMatchObject({ letter: false, special: false });
    expect(isPasswordValid('Abc1234é')).toBe(false);
    expect(isPasswordValid('Abc 123!é é')).toBe(true);
  });

  it('counts every ASCII special character', () => {
    for (const ch of '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~') {
      expect(isPasswordValid(`Abcdef1${ch}`), `special ${ch}`).toBe(true);
    }
  });
});
