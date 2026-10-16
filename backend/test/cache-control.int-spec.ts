import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { parse } from 'yaml';
import { createTestApp, ORIGIN, TestApp } from './helpers/app';

const creds = { email: 'cache@example.com', name: 'Cache Test', password: 'Passw0rd!' };

/**
 * Every response of an /auth operation, success or error, must be `Cache-Control: no-store`: the API sends only an
 * ETag otherwise, and a browser may then replay a cached `GET /auth/me` 200 after sign-out (seen in Chrome on Back).
 * Scope is the auth endpoints only (ADR 0008); /health is not touched.
 */
describe('Cache-Control: no-store on the auth endpoints (real MongoDB)', () => {
  let t: TestApp;
  let signedIn: ReturnType<typeof request.agent>;
  let signUpResponse: request.Response;

  beforeAll(async () => {
    t = await createTestApp({ AUTH_THROTTLE_LIMIT: '1000' });
    signedIn = t.agent();
    signUpResponse = await signedIn.post('/api/auth/signup').set('Origin', ORIGIN).send(creds).expect(201);
  });
  afterAll(() => t.close());

  describe('success responses', () => {
    it('POST /auth/signup 201', () => {
      expect(signUpResponse.headers['cache-control']).toBe('no-store');
    });

    it('GET /auth/me 200', async () => {
      const res = await signedIn.get('/api/auth/me').expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/signin 200', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).send({ email: creds.email, password: creds.password }).expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/logout 204', async () => {
      const agent = t.agent();
      await agent.post('/api/auth/signin').set('Origin', ORIGIN).send({ email: creds.email, password: creds.password }).expect(200);
      const res = await agent.post('/api/auth/logout').set('Origin', ORIGIN).expect(204);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('error responses, including those produced by guards and filters', () => {
    it('GET /auth/me 401 without a session', async () => {
      const res = await t.agent().get('/api/auth/me').expect(401);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/logout 401 without a session', async () => {
      const res = await t.agent().post('/api/auth/logout').set('Origin', ORIGIN).expect(401);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/signin 401 for a wrong password', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).send({ email: creds.email, password: 'Wrong-pass1!' }).expect(401);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/signup 400 for a validation failure', async () => {
      const res = await t.agent().post('/api/auth/signup').set('Origin', ORIGIN).send({ email: 'nope', name: 'x', password: 'short' }).expect(400);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/signup 409 for a duplicate email', async () => {
      const res = await t.agent().post('/api/auth/signup').set('Origin', ORIGIN).send(creds).expect(409);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/signin 403 when the CSRF check fails', async () => {
      const res = await t.agent().post('/api/auth/signin').send({ email: creds.email, password: creds.password }).expect(403);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('answers produced by the body parser before routing', () => {
    it('POST /auth/signin 400 for malformed JSON', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).set('Content-Type', 'application/json').send('{"email":').expect(400);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('POST /auth/signin 413 for a body over 16 kb', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).send({ email: creds.email, password: 'x'.repeat(20_000) }).expect(413);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  it('429 from the strict auth rate limit', async () => {
    const limited = await createTestApp({ AUTH_THROTTLE_LIMIT: '2', THROTTLE_LIMIT: '1000' });
    try {
      const attempt = () => limited.agent().post('/api/auth/signin').set('Origin', ORIGIN).send({ email: 'x@example.com', password: 'Whatever1!' });
      await attempt().expect(401);
      await attempt().expect(401);
      const res = await attempt().expect(429);
      expect(res.headers['cache-control']).toBe('no-store');
    } finally {
      await limited.close();
    }
  });

  it('leaves /health alone (scope is the auth endpoints only)', async () => {
    const res = await t.agent().get('/api/health').expect(200);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  describe('the contract documents it', () => {
    interface Operation {
      responses: Record<string, { headers?: Record<string, unknown> }>;
    }
    const doc = parse(readFileSync(join(__dirname, '..', '..', 'contracts', 'openapi.yaml'), 'utf8')) as {
      paths: Record<string, Record<string, Operation>>;
    };
    const authOperations = Object.entries(doc.paths).flatMap(([path, item]) =>
      path.startsWith('/auth/') ? Object.entries(item).map(([method, op]) => [`${method.toUpperCase()} ${path}`, op] as const) : [],
    );

    it('finds the four auth operations', () => {
      expect(authOperations.map(([name]) => name).sort()).toEqual(['GET /auth/me', 'POST /auth/logout', 'POST /auth/signin', 'POST /auth/signup']);
    });

    it.each(authOperations)('%s declares Cache-Control on its success response', (_name, op) => {
      const success = Object.entries(op.responses).find(([status]) => status.startsWith('2'))?.[1];
      expect(success?.headers).toHaveProperty('Cache-Control');
    });
  });
});
