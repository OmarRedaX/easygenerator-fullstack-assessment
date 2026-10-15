import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersRepository } from '../src/modules/users/users.repository';
import { DuplicateEmailError } from '../src/modules/users/errors';
import { createTestDatabase } from './helpers/db';

describe('UsersRepository (real MongoDB)', () => {
  const db = createTestDatabase(); // throws a clear error before anything runs if the base URI is unsafe
  let repo: UsersRepository;
  let close: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [MongooseModule.forRoot(db.uri), UsersModule] }).compile();
    close = () => mod.close(); // registered before init so a failed init still gets closed
    await mod.init();
    repo = mod.get(UsersRepository);
  });
  afterAll(async () => {
    try {
      await close?.();
    } finally {
      await db.drop(); // runs even if init or close failed
    }
  });

  it('creates a user without returning the hash', async () => {
    const u = await repo.create({ email: 'a@x.com', name: 'Alice', passwordHash: 'h' });
    expect(u).toMatchObject({ email: 'a@x.com', name: 'Alice' });
    expect(u.passwordHash).toBeUndefined();
  });

  it('treats differently-cased/padded emails as duplicates', async () => {
    await repo.create({ email: 'dup@x.com', name: 'Dup', passwordHash: 'h' });
    await expect(repo.create({ email: ' DUP@x.com ', name: 'Dup2', passwordHash: 'h' })).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it('allows exactly one winner under concurrent duplicate signups', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => repo.create({ email: 'race@x.com', name: 'Racer', passwordHash: 'h' })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(5);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(DuplicateEmailError));
  });

  it('findByEmailWithHash returns the hash; findById does not', async () => {
    const created = await repo.create({ email: 'h@x.com', name: 'Hashy', passwordHash: 'secret-hash' });
    expect((await repo.findByEmailWithHash('H@x.com'))?.passwordHash).toBe('secret-hash');
    expect((await repo.findById(created.id))?.passwordHash).toBeUndefined();
  });

  it('returns null for unknown and malformed ids', async () => {
    expect(await repo.findById('not-an-object-id')).toBeNull();
    expect(await repo.findById('64b7f0c2a1b2c3d4e5f60718')).toBeNull();
    expect(await repo.findByEmailWithHash('nobody@x.com')).toBeNull();
  });
});
