import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PasswordHasher } from './password-hasher';
import type { Env } from '../../config/env.schema';

// Wrap (not replace) argon2.hash so one test can make it fail once; everything else uses the real implementation.
jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2');
  return { ...actual, hash: jest.fn(actual.hash) };
});

const values = { ARGON2_MEMORY_KIB: 19456, ARGON2_TIME_COST: 2, ARGON2_PARALLELISM: 1 };
const config = { get: (key: keyof typeof values) => values[key] } as unknown as ConfigService<Env, true>;

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher(config);

  it('produces an argon2id hash with the configured parameters', async () => {
    // argon2 0.45 emits the PHC params as m,p,t (not m,t,p), so match order-independently.
    expect(await hasher.hash('Passw0rd!')).toMatch(
      /^\$argon2id\$v=19\$(?=(?:[^$]*,)?m=19456(?:,|\$))(?=(?:[^$]*,)?t=2(?:,|\$))(?=(?:[^$]*,)?p=1(?:,|\$))[^$]+\$/,
    );
  });
  it('salts: the same password hashes differently', async () => {
    expect(await hasher.hash('Passw0rd!')).not.toEqual(await hasher.hash('Passw0rd!'));
  });
  it('verifies correct and rejects wrong passwords', async () => {
    const h = await hasher.hash('Passw0rd!');
    expect(await hasher.verify(h, 'Passw0rd!')).toBe(true);
    expect(await hasher.verify(h, 'Passw0rd?')).toBe(false);
  });
  it('returns false (not throws) for a malformed hash', async () => {
    expect(await hasher.verify('not-a-hash', 'x')).toBe(false);
  });
  it('verifyDummy resolves without throwing', async () => {
    await expect(hasher.verifyDummy('anything')).resolves.toBeUndefined();
  });
  it('verifyDummy retries the dummy hash after a failed first attempt', async () => {
    const fresh = new PasswordHasher(config);
    jest.mocked(argon2.hash).mockRejectedValueOnce(new Error('boom'));
    await expect(fresh.verifyDummy('anything')).rejects.toThrow('boom');
    await expect(fresh.verifyDummy('anything')).resolves.toBeUndefined();
  });
});
