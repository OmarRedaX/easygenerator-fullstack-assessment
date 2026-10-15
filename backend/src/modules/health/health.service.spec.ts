import type { Connection } from 'mongoose';
import { HealthService } from './health.service';

const make = (db: unknown) => new HealthService({ db } as unknown as Connection);

describe('HealthService', () => {
  it('is up when Mongo answers ping', async () => {
    const command = jest.fn().mockResolvedValue({ ok: 1 });
    await expect(make({ command }).isDatabaseUp()).resolves.toBe(true);
    expect(command).toHaveBeenCalledWith({ ping: 1 });
  });
  it('is down (never throws) when ping fails', async () => {
    await expect(make({ command: jest.fn().mockRejectedValue(new Error('down')) }).isDatabaseUp()).resolves.toBe(false);
  });
  it('is down when there is no database handle', async () => {
    await expect(make(undefined).isDatabaseUp()).resolves.toBe(false);
  });
});
