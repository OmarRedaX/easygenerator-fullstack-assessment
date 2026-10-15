import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { SESSION_ABSOLUTE_TTL_MS } from '../src/common/constants';
import { createTestApp, ORIGIN, TestApp } from './helpers/app';

const valid = { email: 'alice@example.com', name: 'Alice', password: 'Passw0rd!' };
const setCookie = (res: request.Response): string[] => (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
const sid = (res: request.Response): string => setCookie(res)[0]?.split(';')[0] ?? '';

describe('auth (real MongoDB)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  const post = (agent: ReturnType<TestApp['agent']>, path: string, body?: object) =>
    agent.post(`/api${path}`).set('Origin', ORIGIN).send(body);

  describe('POST /auth/signup', () => {
    it('201: creates the user, starts a session, leaks nothing sensitive', async () => {
      const res = await post(t.agent(), '/auth/signup', valid).expect(201);
      expect(res.body.user).toMatchObject({ email: valid.email, name: valid.name });
      expect(res.body.user.id).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Passw0rd|argon2/);
      const cookie = setCookie(res)[0] ?? '';
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/;\s*Secure/i); // NODE_ENV=test
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('409 for the same email in a different case/padding', async () => {
      const res = await post(t.agent(), '/auth/signup', { ...valid, email: '  ALICE@Example.com ' }).expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict', message: 'Email already registered' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('exactly one of many concurrent duplicate signups succeeds', async () => {
      const body = { email: 'race@example.com', name: 'Racer', password: 'Passw0rd!' };
      const results = await Promise.all(Array.from({ length: 5 }, () => post(t.agent(), '/auth/signup', body)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    });

    it.each([
      ['bad email', { ...valid, email: 'nope' }, 'email'],
      ['name of 2 chars', { ...valid, email: 'n1@example.com', name: 'ab' }, 'name'],
      ['whitespace-only name', { ...valid, email: 'n2@example.com', name: '    ' }, 'name'],
      ['password too short', { ...valid, email: 'n3@example.com', password: 'a1!' }, 'password'],
      ['password without special', { ...valid, email: 'n4@example.com', password: 'abcdefg12' }, 'password'],
      ['password with space as the only "special"', { ...valid, email: 'n5@example.com', password: 'abc def 12' }, 'password'],
      ['129-char password', { ...valid, email: 'n6@example.com', password: 'a1!' + 'x'.repeat(126) }, 'password'],
      ['unknown extra field', { ...valid, email: 'n7@example.com', role: 'admin' }, 'role'],
    ])('400 with field details: %s', async (_label, body, field) => {
      const res = await post(t.agent(), '/auth/signup', body).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request', message: 'Validation failed' });
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('400 for a missing body', async () => {
      await t.agent().post('/api/auth/signup').set('Origin', ORIGIN).expect(400);
    });
  });

  describe('sessions', () => {
    it('signup leaves the caller signed in; /me returns the user', async () => {
      const agent = t.agent();
      await post(agent, '/auth/signup', { email: 'bob@example.com', name: 'Bobby', password: 'Passw0rd!' }).expect(201);
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.user).toMatchObject({ email: 'bob@example.com', name: 'Bobby' });
    });

    it('/me without a session is 401', async () => {
      const res = await t.agent().get('/api/auth/me').expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, message: 'Authentication required' });
    });

    it('stores only userId and absoluteExpiresAt (plus express-session cookie) in the session', async () => {
      const res = await post(t.agent(), '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const conn = t.app.get<Connection>(getConnectionToken());
      const docs = await conn.collection('sessions').find({}).toArray();
      expect(docs.length).toBeGreaterThan(0);
      for (const doc of docs) {
        const data = typeof doc.session === 'string' ? JSON.parse(doc.session) : doc.session;
        expect(Object.keys(data).sort()).toEqual(['absoluteExpiresAt', 'cookie', 'userId'].filter((k) => k in data));
        expect(Object.keys(data)).not.toEqual(expect.arrayContaining(['email', 'password', 'passwordHash', 'name']));
      }
      expect(res.body.user.email).toBe(valid.email);
    });

    it('regenerates the session id on every signin and invalidates the old one', async () => {
      const agent = t.agent();
      const first = await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const second = await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      expect(sid(first)).not.toBe('');
      expect(sid(second)).not.toBe(sid(first));
      await request(t.app.getHttpServer()).get('/api/auth/me').set('Cookie', sid(first)).expect(401);
      await request(t.app.getHttpServer()).get('/api/auth/me').set('Cookie', sid(second)).expect(200);
    });

    it('logout destroys the server-side session: replaying the cookie is 401', async () => {
      const agent = t.agent();
      const login = await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const cookie = sid(login);
      const out = await post(agent, '/auth/logout').expect(204);
      expect(setCookie(out)[0] ?? '').toMatch(/^sid=;/);
      await request(t.app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(401);
    });

    it('logout without a session is 401', async () => {
      await post(t.agent(), '/auth/logout').expect(401);
    });

    it('enforces absoluteExpiresAt on the server regardless of cookie/TTL', async () => {
      const agent = t.agent();
      await post(agent, '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      t.clock.advance(SESSION_ABSOLUTE_TTL_MS - 1);
      await agent.get('/api/auth/me').expect(200);
      t.clock.advance(1);
      const expired = await agent.get('/api/auth/me').expect(401);
      expect(expired.body.message).toBe('Session expired');
      expect(setCookie(expired)[0] ?? '').toMatch(/^sid=;/);
      const again = await agent.get('/api/auth/me').expect(401);
      expect(again.body.message).toBe('Authentication required'); // session was destroyed
    });

    it('a session whose user was deleted is destroyed and gets 401', async () => {
      const agent = t.agent();
      await post(agent, '/auth/signup', { email: 'ghost@example.com', name: 'Ghost', password: 'Passw0rd!' }).expect(201);
      const conn = t.app.get<Connection>(getConnectionToken());
      await conn.collection('users').deleteOne({ email: 'ghost@example.com' });
      const res = await agent.get('/api/auth/me').expect(401);
      expect(setCookie(res)[0] ?? '').toMatch(/^sid=;/);
    });
  });

  describe('POST /auth/signin', () => {
    it('401 with the identical generic body for unknown email and wrong password', async () => {
      const unknown = await post(t.agent(), '/auth/signin', { email: 'nobody@example.com', password: 'Whatever1!' }).expect(401);
      const wrong = await post(t.agent(), '/auth/signin', { email: valid.email, password: 'Wrong-pass1!' }).expect(401);
      const strip = ({ requestId: _r, ...rest }: Record<string, unknown>) => rest;
      expect(strip(unknown.body)).toEqual(strip(wrong.body));
      expect(unknown.body.message).toBe('Invalid email or password');
      expect(setCookie(unknown)).toHaveLength(0);
      expect(setCookie(wrong)).toHaveLength(0);
    });

    it('does not re-apply the password policy on signin (weak password is just 401)', async () => {
      await post(t.agent(), '/auth/signin', { email: valid.email, password: 'weak' }).expect(401);
    });

    it('400 for a malformed email or empty password', async () => {
      await post(t.agent(), '/auth/signin', { email: 'bad', password: 'x' }).expect(400);
      await post(t.agent(), '/auth/signin', { email: valid.email, password: '' }).expect(400);
    });
  });

  describe('database isolation', () => {
    it('users and sessions both live in the generated auth_test_ database', async () => {
      expect(t.dbName).toMatch(/^auth_test_[0-9a-f]{12}$/);
      const conn = t.app.get<Connection>(getConnectionToken());
      expect(conn.db?.databaseName).toBe(t.dbName);
      await post(t.agent(), '/auth/signin', { email: valid.email, password: valid.password }).expect(200);
      const db = conn.getClient().db(t.dbName);
      expect(await db.collection('users').countDocuments()).toBeGreaterThan(0);
      expect(await db.collection('sessions').countDocuments()).toBeGreaterThan(0);
    });
  });

  describe('GET /health', () => {
    it('200 when Mongo is reachable', async () => {
      const res = await t.agent().get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
