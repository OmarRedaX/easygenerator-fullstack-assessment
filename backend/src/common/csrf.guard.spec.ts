import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './csrf.guard';
import type { Env } from '../config/env.schema';

const ALLOWED = 'http://localhost:5173';
const config = { get: () => ALLOWED } as unknown as ConfigService<Env, true>;
const guard = new CsrfGuard(config);

const ctx = (method: string, headers: Record<string, string> = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ method, headers }) }) }) as unknown as ExecutionContext;

describe('CsrfGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('lets safe method %s through without headers', (m) => {
    expect(guard.canActivate(ctx(m))).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows %s with the matching Origin', (m) => {
    expect(guard.canActivate(ctx(m, { origin: ALLOWED }))).toBe(true);
  });

  it.each([
    ['foreign Origin', { origin: 'https://evil.example' }],
    ['literal null Origin', { origin: 'null' }],
    ['empty Origin', { origin: '' }],
    ['Origin with different port', { origin: 'http://localhost:3000' }],
    ['no Origin, foreign Referer', { referer: 'https://evil.example/page' }],
    ['no Origin, garbage Referer', { referer: 'not a url' }],
    ['no Origin and no Referer', {}],
    ['matching Origin but Sec-Fetch-Site cross-site', { origin: ALLOWED, 'sec-fetch-site': 'cross-site' }],
    ['foreign Origin even with matching Referer', { origin: 'https://evil.example', referer: `${ALLOWED}/x` }],
  ])('rejects POST: %s', (_label, headers) => {
    expect(() => guard.canActivate(ctx('POST', headers))).toThrow(ForbiddenException);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(guard.canActivate(ctx('POST', { referer: `${ALLOWED}/signin?x=1` }))).toBe(true);
  });

  it('accepts same-site Sec-Fetch-Site with matching Origin', () => {
    expect(guard.canActivate(ctx('POST', { origin: ALLOWED, 'sec-fetch-site': 'same-site' }))).toBe(true);
  });
});
