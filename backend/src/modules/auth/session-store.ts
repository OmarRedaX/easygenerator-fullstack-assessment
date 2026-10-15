import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MongoStore from 'connect-mongo';
import { SESSION_ABSOLUTE_TTL_MS } from '../../common/constants';
import type { Env } from '../../config/env.schema';

/** TTL index / touchAfter are storage housekeeping only; SessionGuard enforces the real 7-day limit. */
@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  readonly store: MongoStore;

  constructor(config: ConfigService<Env, true>) {
    this.store = MongoStore.create({
      mongoUrl: config.get('MONGODB_URI', { infer: true }),
      collectionName: 'sessions',
      ttl: SESSION_ABSOLUTE_TTL_MS / 1000,
      touchAfter: 24 * 3600,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }
}
