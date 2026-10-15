import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import './request.types';

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
