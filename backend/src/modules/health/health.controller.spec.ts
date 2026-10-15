import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

const make = (up: boolean) => new HealthController({ isDatabaseUp: jest.fn().mockResolvedValue(up) } as unknown as HealthService);

describe('HealthController', () => {
  it('returns ok when the database is up', async () => {
    await expect(make(true).check()).resolves.toEqual({ status: 'ok' });
  });
  it('maps a down database to 503', async () => {
    await expect(make(false).check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
