import { describe, expect, it } from 'vitest';
import { returnPathFromState, safeReturnPath } from './safeReturnPath';

describe('safeReturnPath', () => {
  it.each(['/', '/a', '/a?b=1', '/deep/path?x=1#hash'])('accepts the internal path %s', (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    '//evil.com',
    '//evil.com/path',
    'https://evil.com',
    'http://localhost:5173/',
    'javascript:alert(1)',
    '/\\evil.com',
    '/signin',
    '/signup',
    '/signin?x=1',
    'relative',
    '',
  ])('falls back to / for %s', (path) => {
    expect(safeReturnPath(path)).toBe('/');
  });

  it.each([undefined, null, 42, {}, ['/a']])('falls back to / for non-string %j', (value) => {
    expect(safeReturnPath(value)).toBe('/');
  });
});

describe('returnPathFromState', () => {
  it('reads a safe return path out of router state', () => {
    expect(returnPathFromState({ from: '/dashboard?x=1' })).toBe('/dashboard?x=1');
  });

  it.each([null, undefined, 'x', 42, {}, { from: 5 }, { from: '//evil.example' }, { from: '/signin' }])(
    'falls back to / for %j',
    (state) => {
      expect(returnPathFromState(state)).toBe('/');
    },
  );
});
