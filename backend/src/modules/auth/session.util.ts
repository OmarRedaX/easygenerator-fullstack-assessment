import type { Request } from 'express';
import { SESSION_ABSOLUTE_TTL_MS } from '../../common/constants';
import './session.types';

const settle = (run: (cb: (err?: unknown) => void) => void): Promise<void> =>
  new Promise((resolve, reject) => run((err) => (err ? reject(err) : resolve())));

export const regenerateSession = (req: Request): Promise<void> => settle((cb) => req.session.regenerate(cb));
export const saveSession = (req: Request): Promise<void> => settle((cb) => req.session.save(cb));
export const destroySession = (req: Request): Promise<void> => settle((cb) => req.session.destroy(cb));

/** New session ID on every authentication (fixation defence); absolute expiry fixed at creation. */
export async function startAuthenticatedSession(req: Request, userId: string, nowMs: number): Promise<void> {
  await regenerateSession(req);
  req.session.userId = userId;
  req.session.absoluteExpiresAt = nowMs + SESSION_ABSOLUTE_TTL_MS;
  await saveSession(req);
}
