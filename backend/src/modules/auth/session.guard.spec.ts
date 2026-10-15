import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionGuard } from './session.guard';
import type { Clock } from '../../common/clock';
import type { Env } from '../../config/env.schema';

const values = { SESSION_COOKIE_NAME: 'sid', NODE_ENV: 'production' };
const config = { get: (k: keyof typeof values) => values[k] } as unknown as ConfigService<Env, true>;

function setup(session: Record<string, unknown>, now: number) {
  const destroy = jest.fn((cb: (e?: unknown) => void) => cb());
  const clearCookie = jest.fn();
  const clock: Clock = { now: () => now };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ session: { ...session, destroy } }),
      getResponse: () => ({ clearCookie }),
    }),
  } as unknown as ExecutionContext;
  return { guard: new SessionGuard(clock, config), ctx, destroy, clearCookie };
}

describe('SessionGuard', () => {
  it('allows a live session', async () => {
    const { guard, ctx } = setup({ userId: 'u1', absoluteExpiresAt: 2000 }, 1000);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it.each([
    ['no session data', {}],
    ['no userId', { absoluteExpiresAt: 2000 }],
    ['no absoluteExpiresAt', { userId: 'u1' }],
    ['non-numeric absoluteExpiresAt', { userId: 'u1', absoluteExpiresAt: '2000' }],
  ])('rejects %s with 401 and does not clear anything', async (_l, session) => {
    const { guard, ctx, destroy, clearCookie } = setup(session, 1000);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(destroy).not.toHaveBeenCalled();
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it.each([1999, 2000, 5000])('expires at/after absoluteExpiresAt (now=%d vs 2000 boundary uses >=)', async (now) => {
    const { guard, ctx, destroy, clearCookie } = setup({ userId: 'u1', absoluteExpiresAt: 2000 }, now);
    if (now < 2000) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      return;
    }
    await expect(guard.canActivate(ctx)).rejects.toThrow('Session expired');
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(clearCookie).toHaveBeenCalledWith('sid', { httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
  });
});
