import { validatePassword } from './password-policy';

describe('validatePassword', () => {
  it('accepts a minimal valid password', () => expect(validatePassword('abcdef1!')).toEqual([]));
  it('accepts 128 chars and rejects 129', () => {
    expect(validatePassword('a1!' + 'x'.repeat(125))).toEqual([]);
    expect(validatePassword('a1!' + 'x'.repeat(126))).toHaveLength(1);
  });
  it('rejects 7 chars and accepts 8', () => {
    expect(validatePassword('abcde1!')).toHaveLength(1);
    expect(validatePassword('abcdef1!')).toEqual([]);
  });
  it.each([
    ['no letter', '12345678!'],
    ['no digit', 'abcdefgh!'],
    ['no special', 'abcdefg12'],
  ])('rejects %s', (_l, pw) => expect(validatePassword(pw)).toHaveLength(1));
  it('does not count a space as special', () => expect(validatePassword('abc def 12')).toHaveLength(1));
  it('does not count unicode letters or digits as classes', () => {
    expect(validatePassword('éééééé١٢!')).toHaveLength(2);
  });
  it.each([...'!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'])('counts %s as special', (c) => {
    expect(validatePassword(`abcdef1${c}`)).toEqual([]);
  });
});
