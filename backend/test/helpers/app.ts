import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp, NEST_APP_OPTIONS } from '../../src/app.setup';
import { CLOCK, Clock } from '../../src/common/clock';
import { createTestDatabase } from './db';

export const ORIGIN = 'http://localhost:5173';

export class MutableClock implements Clock {
  constructor(private current = Date.now()) {}
  now(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

export interface TestApp {
  app: NestExpressApplication;
  clock: MutableClock;
  /** Name of the isolated auth_test_<12 hex> database used by both users and sessions. */
  dbName: string;
  agent(): ReturnType<typeof request.agent>;
  close(): Promise<void>;
}

// The harness owns the database: callers may not point the app at another one.
const FORBIDDEN_OVERRIDES = ['MONGODB_URI', 'TEST_MONGODB_URI'];

/** Boots the real pipeline against a real MongoDB in a unique auth_test_ database; `env` overrides other config. */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const forbidden = FORBIDDEN_OVERRIDES.filter((key) => key in env);
  if (forbidden.length > 0) {
    throw new Error(`createTestApp: ${forbidden.join(', ')} cannot be overridden; the harness owns the isolated database URI`);
  }

  const db = createTestDatabase(); // validates the base URI before anything is created
  const clock = new MutableClock();
  let moduleRef: TestingModule | undefined;
  let app: NestExpressApplication | undefined;

  const cleanup = async (): Promise<void> => {
    const failures: unknown[] = [];
    try {
      await (app ?? moduleRef)?.close();
    } catch (err) {
      failures.push(err);
    }
    try {
      await db.drop(); // re-verifies the auth_test_ name; a no-op error-free drop if the database never existed
    } catch (err) {
      failures.push(err);
    }
    if (failures.length > 0) throw new AggregateError(failures, `Test cleanup failed for ${db.name}`);
  };

  try {
    // MONGODB_URI is applied last so nothing else can replace it. ConfigService feeds the same value to
    // Mongoose (users) and connect-mongo (sessions), so both live in the isolated database.
    moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ ...env, MONGODB_URI: db.uri })] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>({ ...NEST_APP_OPTIONS });
    app = nestApp;
    configureApp(nestApp);
    await nestApp.init();
    return {
      app: nestApp,
      clock,
      dbName: db.name,
      agent: () => request.agent(nestApp.getHttpServer()),
      close: cleanup,
    };
  } catch (err) {
    await cleanup().catch((cleanupErr: unknown) => {
      process.stderr.write(`Cleanup after failed test-app init also failed: ${String(cleanupErr)}\n`);
    });
    throw err;
  }
}
