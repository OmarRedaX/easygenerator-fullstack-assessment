import type { ConfigService } from '@nestjs/config';
import type { Env } from '../src/config/env.schema';
import { SessionStoreService } from '../src/modules/auth/session-store';
import { createTestDatabase } from './helpers/db';

describe('SessionStoreService', () => {
  it('lets the store finish its startup index build before closing, so an immediate shutdown is clean', async () => {
    const db = createTestDatabase();
    const config = { get: () => db.uri } as unknown as ConfigService<Env, true>;
    try {
      // Closing right after construction is what a failed boot or a short-lived app does; it used to interrupt the
      // TTL-index build still in flight and surface as MongoClientClosedError / MongoExpiredSessionError.
      for (let i = 0; i < 10; i++) {
        const service = new SessionStoreService(config);
        await expect(service.onModuleDestroy()).resolves.toBeUndefined();
        await expect(service.store.collectionP).resolves.toBeDefined();
      }
    } finally {
      await db.drop();
    }
  });
});
