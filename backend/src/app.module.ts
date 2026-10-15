import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import { CsrfGuard } from './common/csrf.guard';
import { buildPinoHttpOptions } from './common/logging';
import { appConfigModule } from './config/config.module';
import type { Env } from './config/env.schema';
import { AUTH_THROTTLED } from './modules/auth/auth-throttle';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({})
export class AppModule {
  static register(overrides: Record<string, unknown> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        appConfigModule(overrides),
        LoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            pinoHttp: buildPinoHttpOptions(config.get('LOG_LEVEL', { infer: true })),
          }),
        }),
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            uri: config.get('MONGODB_URI', { infer: true }),
            serverSelectionTimeoutMS: 5000,
            retryAttempts: 0, // fail fast at boot
          }),
        }),
        ThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => [
            { name: 'default', ttl: 60_000, limit: config.get('THROTTLE_LIMIT', { infer: true }) },
            {
              name: 'auth',
              ttl: 60_000,
              limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
              skipIf: (ctx) => !new Reflector().get<boolean>(AUTH_THROTTLED, ctx.getHandler()),
            },
          ],
        }),
        CommonModule,
        UsersModule,
        AuthModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
      ],
    };
  }
}
