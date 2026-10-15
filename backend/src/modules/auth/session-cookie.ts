import type { CookieOptions } from 'express';
import type { Env } from '../../config/env.schema';

export function sessionCookieOptions(nodeEnv: Env['NODE_ENV']): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: nodeEnv === 'production', path: '/' };
}
