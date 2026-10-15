import { randomBytes } from 'node:crypto';
import { ConnectionString } from 'mongodb-connection-string-url';
import mongoose from 'mongoose';

export const TEST_DB_PREFIX = 'auth_test_';
const TEST_DB_NAME = /^auth_test_[0-9a-f]{12}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface TestDatabase {
  readonly name: string;
  readonly uri: string;
  /** Drops only this generated database. Idempotent; refuses anything that is not auth_test_<12 hex>. */
  drop(): Promise<void>;
}

export function assertTestDatabaseName(name: string): void {
  if (!TEST_DB_NAME.test(name)) {
    throw new Error(`Refusing to use database "${name}": test databases must match ${TEST_DB_NAME}`);
  }
}

const hostnameOf = (hostAndPort: string): string =>
  hostAndPort.startsWith('[') ? hostAndPort.slice(0, hostAndPort.indexOf(']') + 1) : (hostAndPort.split(':')[0] ?? hostAndPort);

/** Parses the server URI and returns it with only the database replaced by `dbName`. */
export function buildTestDatabaseUri(baseUri: string, dbName: string, opts: { allowRemote: boolean }): string {
  assertTestDatabaseName(dbName);

  let cs: ConnectionString;
  try {
    cs = new ConnectionString(baseUri);
  } catch {
    throw new Error('Test MongoDB URI is not a valid mongodb:// or mongodb+srv:// connection string');
  }

  const named = cs.pathname.replace(/^\/+/, '');
  if (named !== '') {
    throw new Error(
      `Test MongoDB URI must not name a database (found "${named}"); the harness generates ${TEST_DB_PREFIX}* itself. ` +
        'Point TEST_MONGODB_URI (or MONGODB_URI) at the server only, e.g. mongodb://127.0.0.1:27017',
    );
  }

  const remote = cs.hosts.map(hostnameOf).filter((h) => !LOCAL_HOSTS.has(h));
  if (remote.length > 0 && !opts.allowRemote) {
    throw new Error(`Refusing destructive tests against non-local host(s): ${remote.join(', ')}. Set ALLOW_REMOTE_TEST_DB=true to allow.`);
  }

  cs.pathname = `/${dbName}`;
  return cs.toString();
}

export function createTestDatabase(env: NodeJS.ProcessEnv = process.env): TestDatabase {
  const baseUri = env.TEST_MONGODB_URI ?? env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
  const name = `${TEST_DB_PREFIX}${randomBytes(6).toString('hex')}`;
  const uri = buildTestDatabaseUri(baseUri, name, { allowRemote: env.ALLOW_REMOTE_TEST_DB === 'true' });
  let dropped = false;

  return {
    name,
    uri,
    async drop(): Promise<void> {
      if (dropped) return;
      assertTestDatabaseName(name);
      const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
      try {
        const actual = conn.db?.databaseName;
        if (actual !== name) {
          throw new Error(`Connected to database "${actual}" but expected "${name}"; refusing to drop`);
        }
        await conn.dropDatabase();
        dropped = true;
      } finally {
        await conn.close();
      }
    },
  };
}
