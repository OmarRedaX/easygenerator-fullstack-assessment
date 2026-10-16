import type { ConfigService } from '@nestjs/config';
import MongoStore from 'connect-mongo';
import type { Env } from '../../config/env.schema';
import { SessionStoreService } from './session-store';

jest.mock('connect-mongo', () => ({ __esModule: true, default: { create: jest.fn() } }));

const config = { get: () => 'mongodb://127.0.0.1:27017/ignored' } as unknown as ConfigService<Env, true>;

interface Deferred {
  promise: Promise<unknown>;
  resolve: () => void;
  reject: (reason: Error) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = () => res(undefined);
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** connect-mongo connects and builds its TTL index in the background (`collectionP`); `close` just closes the client. */
function setup() {
  const startup = deferred();
  const close = jest.fn().mockResolvedValue(undefined);
  (MongoStore.create as jest.Mock).mockReturnValue({ collectionP: startup.promise, close });
  return { service: new SessionStoreService(config), startup, close };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('SessionStoreService.onModuleDestroy', () => {
  it('lets the store finish starting up before it closes the client', async () => {
    const { service, startup, close } = setup();

    const destroyed = service.onModuleDestroy();
    await flush();
    // Closing now would interrupt the in-flight connection / index build with MongoClientClosedError.
    expect(close).not.toHaveBeenCalled();

    startup.resolve();
    await destroyed;
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('still closes the client, without throwing, when the startup failed', async () => {
    const { service, startup, close } = setup();

    const destroyed = service.onModuleDestroy();
    startup.reject(new Error('connection refused'));

    await expect(destroyed).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports a failure to close the client', async () => {
    const { service, startup, close } = setup();
    close.mockRejectedValue(new Error('close failed'));
    startup.resolve();

    await expect(service.onModuleDestroy()).rejects.toThrow('close failed');
  });
});
