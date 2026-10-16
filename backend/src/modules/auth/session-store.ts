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
    // connect-mongo builds the TTL index in the background after connecting; closing the client mid-build rejects
    // that promise (MongoClientClosedError), so let it settle first. A failure there is not ours to surface on shutdown.
    await this.store.collectionP.catch(() => undefined);
    await this.store.close();
  }
}
