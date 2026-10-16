import type { NextFunction, Request, Response } from 'express';

/**
 * Auth responses say who is signed in, so no cache may keep them. Without this the API sends only an ETag and a
 * browser may replay a cached `GET /auth/me` 200 after sign-out (seen in Chrome on Back). Mounted on `/api/auth` in
 * `configureApp` (ADR 0008), ahead of the body parser and the guards, so error answers carry it too.
 */
export function noStoreMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
