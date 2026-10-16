import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { bodyParserErrorMiddleware } from './common/body-parser-error.middleware';
import { SESSION_ABSOLUTE_TTL_MS } from './common/constants';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestIdMiddleware } from './common/request-id.middleware';
import type { Env } from './config/env.schema';
import { setupSwagger } from './docs/swagger';
import { noStoreMiddleware } from './modules/auth/no-store.middleware';
import { sessionCookieOptions } from './modules/auth/session-cookie';
import { SessionStoreService } from './modules/auth/session-store';

const API_PREFIX = 'api';

const toDetails = (errors: ValidationError[]) =>
  errors.map((e) => ({ field: e.property, messages: Object.values(e.constraints ?? {}) }));

/**
 * Nest options both main.ts and the test helper must pass. `bodyParser: false` stops Nest registering its default
 * JSON and urlencoded parsers (the urlencoded one has a 100 kb limit and the API is JSON-only); configureApp then
 * adds the single 16 kb JSON parser.
 */
export const NEST_APP_OPTIONS = { bodyParser: false } as const;

/** Shared by main.ts and the integration tests so both run the exact same pipeline. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  const hops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (hops > 0) app.set('trust proxy', hops);

  app.use(requestIdMiddleware);
  app.use(helmet());
  // Authentication answers say who is signed in, so nothing may cache them (ADR 0008). Mounted by path, before the
  // body parser, so 400/413 answers for a bad body and errors from guards and filters carry it too.
  app.use(`/${API_PREFIX}/auth`, noStoreMiddleware);
  const allowedOrigin = config.get('CORS_ORIGIN', { infer: true });
  app.enableCors({
    // Exact match only: a foreign Origin gets no CORS headers at all (a static string would echo ours to everyone).
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
      callback(null, origin === allowedOrigin),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.use(
    session({
      name: config.get('SESSION_COOKIE_NAME', { infer: true }),
      secret: config.get('SESSION_SECRET', { infer: true }),
      resave: false,
      saveUninitialized: false,
      rolling: false,
      store: app.get(SessionStoreService).store,
      cookie: { ...sessionCookieOptions(nodeEnv), maxAge: SESSION_ABSOLUTE_TTL_MS },
    }),
  );
  app.useBodyParser('json', { limit: '16kb' });
  app.use(bodyParserErrorMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException({ message: 'Validation failed', details: toDetails(errors) }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix(API_PREFIX);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  setupSwagger(app);
}
