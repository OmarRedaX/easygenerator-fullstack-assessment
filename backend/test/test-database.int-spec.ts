import { ConnectionString } from 'mongodb-connection-string-url';
import mongoose from 'mongoose';
import { assertTestDatabaseName, buildTestDatabaseUri, createTestDatabase } from './helpers/db';

const NAME = 'auth_test_0123456789ab';
const NAME_PATTERN = /^auth_test_[0-9a-f]{12}$/;

describe('test database harness', () => {
  describe('buildTestDatabaseUri', () => {
    it('replaces only the database, preserving credentials, hosts and options', () => {
      const uri = buildTestDatabaseUri(
        'mongodb://user:p%40ss@127.0.0.1:27017,localhost:27018/?replicaSet=rs0&authSource=admin',
        NAME,
        { allowRemote: false },
      );
      const cs = new ConnectionString(uri);
      expect(cs.pathname).toBe(`/${NAME}`);
      expect(cs.hosts).toEqual(['127.0.0.1:27017', 'localhost:27018']);
      expect(cs.username).toBe('user');
      expect(cs.password).toBe('p%40ss');
      expect(cs.searchParams.get('replicaSet')).toBe('rs0');
      expect(cs.searchParams.get('authSource')).toBe('admin');
    });

    it.each([
      ['a URI that already names a database', 'mongodb://127.0.0.1:27017/easygenerator', /must not name a database/],
      ['a non-mongodb scheme', 'http://127.0.0.1:27017', /valid mongodb/],
      ['garbage', 'not a uri', /valid mongodb/],
      ['an empty string', '', /valid mongodb/],
    ])('rejects %s', (_label, base, message) => {
      expect(() => buildTestDatabaseUri(base, NAME, { allowRemote: false })).toThrow(message);
    });

    it.each(['mongodb://db.example.com:27017', 'mongodb://127.0.0.1:27017,db.example.com:27017', 'mongodb+srv://cluster0.example.mongodb.net'])(
      'refuses non-local host %s unless explicitly allowed',
      (base) => {
        expect(() => buildTestDatabaseUri(base, NAME, { allowRemote: false })).toThrow(/non-local/);
        expect(() => buildTestDatabaseUri(base, NAME, { allowRemote: true })).not.toThrow();
      },
    );

    it.each(['mongodb://localhost:27017', 'mongodb://127.0.0.1:27017', 'mongodb://[::1]:27017'])('accepts local host %s', (base) => {
      expect(new ConnectionString(buildTestDatabaseUri(base, NAME, { allowRemote: false })).pathname).toBe(`/${NAME}`);
    });

    it('refuses a database name that is not a generated test name', () => {
      expect(() => buildTestDatabaseUri('mongodb://127.0.0.1:27017', 'easygenerator', { allowRemote: false })).toThrow(/test databases must match/);
    });
  });

  describe('assertTestDatabaseName', () => {
    it.each(['admin', 'local', 'config', 'test', 'easygenerator', 'auth_test_', 'auth_test_xyz', 'AUTH_TEST_0123456789ab', 'auth_test_0123456789abc', 'auth_test_0123456789ab;x', ''])(
      'rejects %j',
      (name) => expect(() => assertTestDatabaseName(name)).toThrow(),
    );
    it('accepts a generated name', () => expect(() => assertTestDatabaseName(NAME)).not.toThrow());
  });

  describe('createTestDatabase', () => {
    const local = { MONGODB_URI: 'mongodb://127.0.0.1:27017' };

    it('generates unique auth_test_ databases', () => {
      const a = createTestDatabase(local);
      const b = createTestDatabase(local);
      expect(a.name).toMatch(NAME_PATTERN);
      expect(b.name).toMatch(NAME_PATTERN);
      expect(a.name).not.toBe(b.name);
      expect(a.uri).toContain(`/${a.name}`);
    });

    it('prefers TEST_MONGODB_URI over MONGODB_URI', () => {
      const db = createTestDatabase({ TEST_MONGODB_URI: 'mongodb://localhost:27099', MONGODB_URI: 'mongodb://127.0.0.1:27017' });
      expect(new ConnectionString(db.uri).hosts).toEqual(['localhost:27099']);
    });

    it('fails fast when the configured URI names a (possibly real) database', () => {
      expect(() => createTestDatabase({ MONGODB_URI: 'mongodb://127.0.0.1:27017/easygenerator' })).toThrow(/must not name a database/);
    });

    it('honours ALLOW_REMOTE_TEST_DB only when exactly "true"', () => {
      const remote = { MONGODB_URI: 'mongodb://db.example.com:27017' };
      expect(() => createTestDatabase(remote)).toThrow(/non-local/);
      expect(() => createTestDatabase({ ...remote, ALLOW_REMOTE_TEST_DB: '1' })).toThrow(/non-local/);
      expect(() => createTestDatabase({ ...remote, ALLOW_REMOTE_TEST_DB: 'true' })).not.toThrow();
    });

    it('drops only its own database, and drop() is idempotent (real MongoDB)', async () => {
      const db = createTestDatabase();
      const conn = await mongoose.createConnection(db.uri).asPromise();
      try {
        await conn.collection('probe').insertOne({ ok: true });
        const names = async () => (await conn.getClient().db().admin().listDatabases()).databases.map((d) => d.name);
        expect(await names()).toContain(db.name);
        await db.drop();
        expect(await names()).not.toContain(db.name);
        await expect(db.drop()).resolves.toBeUndefined();
      } finally {
        await conn.close();
      }
    });
  });
});
