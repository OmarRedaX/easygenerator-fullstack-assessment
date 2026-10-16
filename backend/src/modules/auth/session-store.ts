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
    // connect-mongo connects and builds its TTL index in the background (`collectionP`) and nothing awaits that
    // until a request needs the store. Closing the client while it is still running rejects it with
    // MongoClientClosedError, which nobody handles: an app that is stopped right after it starts (tests, a crash
    // loop, a failed init) then fails randomly. Let startup settle first; a startup failure is not this hook's to
    // report, the client is closed either way.
    await this.store.collectionP.catch(() => undefined);
    await this.store.close();
  }
}
