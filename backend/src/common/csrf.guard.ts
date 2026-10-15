import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../config/env.schema';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Fail-closed CSRF defence for cookie sessions (supported topology: same-site only).
 * Order: Sec-Fetch-Site cross-site -> reject; Origin present -> must equal CORS_ORIGIN;
 * else Referer origin must equal CORS_ORIGIN; else reject. Never silently allows.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: ConfigService<Env, true>) {
    this.allowedOrigin = config.get('CORS_ORIGIN', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    if (req.headers['sec-fetch-site'] === 'cross-site') return this.deny();

    const origin = req.headers.origin;
    if (origin !== undefined) return origin === this.allowedOrigin ? true : this.deny();

    const referer = req.headers.referer;
    if (typeof referer === 'string') {
      try {
        if (new URL(referer).origin === this.allowedOrigin) return true;
      } catch {
        // unparsable Referer falls through to deny
      }
    }
    return this.deny();
  }

  private deny(): never {
    throw new ForbiddenException('CSRF check failed');
  }
}
