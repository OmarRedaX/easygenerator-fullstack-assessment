import { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnv } from './env.schema';

/** Called from AppModule.register(); validation runs at call time, never at import time. */
export const appConfigModule = (overrides: Record<string, unknown> = {}): Promise<DynamicModule> =>
  ConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    envFilePath: '.env',
    validate: (raw) => parseEnv({ ...raw, ...overrides }),
  });
