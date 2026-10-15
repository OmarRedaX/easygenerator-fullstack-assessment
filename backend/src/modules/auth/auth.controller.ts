import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CLOCK, Clock } from '../../common/clock';
import type { Env } from '../../config/env.schema';
import { PublicUser, UsersService } from '../users/users.service';
import { AuthThrottled } from './auth-throttle';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { sessionCookieOptions } from './session-cookie';
import { SessionGuard } from './session.guard';
import { destroySession, startAuthenticatedSession } from './session.util';
import './session.types';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookieOptions: ReturnType<typeof sessionCookieOptions>;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    @Inject(CLOCK) private readonly clock: Clock,
    config: ConfigService<Env, true>,
  ) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.cookieOptions = sessionCookieOptions(config.get('NODE_ENV', { infer: true }));
  }

  @Post('signup')
  @HttpCode(201)
  @AuthThrottled()
  async signUp(@Body() dto: SignUpDto, @Req() req: Request): Promise<{ user: PublicUser }> {
    const user = await this.auth.signUp(dto);
    await startAuthenticatedSession(req, user.id, this.clock.now());
    return { user: this.users.toPublic(user) };
  }

  @Post('signin')
  @HttpCode(200)
  @AuthThrottled()
  async signIn(@Body() dto: SignInDto, @Req() req: Request): Promise<{ user: PublicUser }> {
    const user = await this.auth.signIn(dto.email, dto.password);
    await startAuthenticatedSession(req, user.id, this.clock.now());
    return { user: this.users.toPublic(user) };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await destroySession(req);
    res.clearCookie(this.cookieName, this.cookieOptions);
  }

  /** The protected endpoint. */
  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ user: PublicUser }> {
    const userId = req.session.userId;
    const user = userId ? await this.users.findById(userId) : null;
    if (!user) {
      await destroySession(req);
      res.clearCookie(this.cookieName, this.cookieOptions);
      throw new UnauthorizedException('Authentication required');
    }
    return { user: this.users.toPublic(user) };
  }
}
