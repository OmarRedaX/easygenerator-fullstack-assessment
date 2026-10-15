import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CLOCK, Clock } from '../../common/clock';
import type { Env } from '../../config/env.schema';
import { sessionCookieOptions } from './session-cookie';
import { destroySession } from './session.util';
import './session.types';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly cookieName: string;
  private readonly cookieOptions: ReturnType<typeof sessionCookieOptions>;

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService<Env, true>,
  ) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.cookieOptions = sessionCookieOptions(config.get('NODE_ENV', { infer: true }));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { userId, absoluteExpiresAt } = req.session;

    if (!userId || typeof absoluteExpiresAt !== 'number') {
      throw new UnauthorizedException('Authentication required');
    }
    if (this.clock.now() >= absoluteExpiresAt) {
      await destroySession(req);
      http.getResponse<Response>().clearCookie(this.cookieName, this.cookieOptions);
      throw new UnauthorizedException('Session expired');
    }
    return true;
  }
}
