import { parseEnv } from './env.schema';

const valid = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
  SESSION_SECRET: 'Zk3vQ9mT2xR7pL5wN8bC4hJ6yD1fG0sAqE+uV/oXiMk=',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    expect(parseEnv(valid)).toMatchObject({
      NODE_ENV: 'development', PORT: 3000, SESSION_COOKIE_NAME: 'sid', TRUST_PROXY_HOPS: 0,
      ARGON2_MEMORY_KIB: 19456, ARGON2_TIME_COST: 2, ARGON2_PARALLELISM: 1,
      THROTTLE_LIMIT: 100, AUTH_THROTTLE_LIMIT: 10,
    });
  });

  it.each([
    ['too short', 'c2hvcnQ='],
    ['not base64', 'not base64 at all!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'],
    ['placeholder', Buffer.from('replace-me-with-a-real-secret-value!!').toString('base64')],
    ['low variety', 'A'.repeat(44)],
  ])('rejects SESSION_SECRET: %s', (_label, secret) => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: secret })).toThrow(/SESSION_SECRET/);
  });

  it.each(['my sid', 'a;b', 'a=b', 'sid\n', 'séssion'])('rejects SESSION_COOKIE_NAME that is not a cookie token: %j', (name) => {
    expect(() => parseEnv({ ...valid, SESSION_COOKIE_NAME: name })).toThrow(/SESSION_COOKIE_NAME/);
  });

  it('accepts a valid custom SESSION_COOKIE_NAME', () => {
    expect(parseEnv({ ...valid, SESSION_COOKIE_NAME: 'eg.sid-1' }).SESSION_COOKIE_NAME).toBe('eg.sid-1');
  });

  it.each(['http://localhost:5173/', 'http://localhost:5173/app', 'localhost:5173', '*'])(
    'rejects CORS_ORIGIN %s', (origin) => {
      expect(() => parseEnv({ ...valid, CORS_ORIGIN: origin })).toThrow(/CORS_ORIGIN/);
    });

  it.each([
    ['ARGON2_MEMORY_KIB', '19455'], ['ARGON2_TIME_COST', '1'], ['ARGON2_PARALLELISM', '0'],
  ])('rejects %s below the floor', (key, value) => {
    expect(() => parseEnv({ ...valid, [key]: value })).toThrow(new RegExp(key));
  });

  it('requires MONGODB_URI', () => {
    expect(() => parseEnv({ ...valid, MONGODB_URI: '' })).toThrow(/MONGODB_URI/);
  });
});
