import request from 'supertest';
import { createTestApp, ORIGIN, TestApp } from './helpers/app';

const creds = { email: 'sec@example.com', name: 'Secure', password: 'Passw0rd!' };

describe('security (real MongoDB)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    await t.agent().post('/api/auth/signup').set('Origin', ORIGIN).send(creds).expect(201);
  });
  afterAll(() => t.close());

  describe('CSRF fails closed on unsafe methods', () => {
    const routes = [
      ['/api/auth/signup', { email: 'x1@example.com', name: 'Xavier', password: 'Passw0rd!' }],
      ['/api/auth/signin', { email: creds.email, password: creds.password }],
      ['/api/auth/logout', {}],
    ] as const;

    it.each(routes)('%s: no Origin and no Referer -> 403', async (path, body) => {
      const res = await t.agent().post(path).send(body).expect(403);
      expect(res.body).toMatchObject({ statusCode: 403, error: 'Forbidden', message: 'CSRF check failed' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it.each(routes)('%s: foreign Origin -> 403', async (path, body) => {
      await t.agent().post(path).set('Origin', 'https://evil.example').send(body).expect(403);
    });

    it.each(routes)('%s: literal "null" Origin -> 403', async (path, body) => {
      await t.agent().post(path).set('Origin', 'null').send(body).expect(403);
    });

    it('Sec-Fetch-Site: cross-site is rejected even with the right Origin', async () => {
      await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).set('Sec-Fetch-Site', 'cross-site')
        .send({ email: creds.email, password: creds.password }).expect(403);
    });

    it('falls back to a matching Referer when Origin is absent', async () => {
      await t.agent().post('/api/auth/signin').set('Referer', `${ORIGIN}/signin`)
        .send({ email: creds.email, password: creds.password }).expect(200);
    });

    it('a foreign Referer without Origin is rejected', async () => {
      await t.agent().post('/api/auth/signin').set('Referer', 'https://evil.example/')
        .send({ email: creds.email, password: creds.password }).expect(403);
    });

    it('safe methods do not need Origin', async () => {
      await t.agent().get('/api/health').expect(200);
    });
  });

  describe('CORS', () => {
    it('answers the preflight for the configured origin with credentials', async () => {
      const res = await t.agent().options('/api/auth/signin')
        .set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
    it('does not grant any other origin', async () => {
      const res = await t.agent().options('/api/auth/signin')
        .set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('hardening', () => {
    it('sends helmet headers and hides the framework', async () => {
      const res = await t.agent().get('/api/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('echoes a safe client X-Request-Id and replaces an unsafe one', async () => {
      const ok = await t.agent().get('/api/health').set('X-Request-Id', 'client-req-12345');
      expect(ok.headers['x-request-id']).toBe('client-req-12345');
      const bad = await t.agent().get('/api/health').set('X-Request-Id', 'a b');
      expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('413 in the envelope for a body over 16 kb', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN)
        .send({ email: creds.email, password: 'x'.repeat(20_000) }).expect(413);
      expect(res.body).toMatchObject({ statusCode: 413, message: 'Request body too large' });
      expect(res.body.requestId).toEqual(expect.any(String));
    });

    it('400 in the envelope for malformed JSON', async () => {
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN)
        .set('Content-Type', 'application/json').send('{"email": ').expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Malformed JSON body' });
    });

    it('404 uses the envelope too, without stack traces', async () => {
      const res = await t.agent().get('/api/nope').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
      expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
    });

    it('does not parse form-encoded bodies, so the 16 kb JSON-only limit cannot be sidestepped', async () => {
      const body = `email=${encodeURIComponent(creds.email)}&password=${'x'.repeat(90_000)}`;
      const res = await t.agent().post('/api/auth/signin').set('Origin', ORIGIN)
        .set('Content-Type', 'application/x-www-form-urlencoded').send(body).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
    });

    it('rejects a non-JSON content type body as a validation error', async () => {
      await t.agent().post('/api/auth/signin').set('Origin', ORIGIN).set('Content-Type', 'text/plain').send('email=a').expect(400);
    });
  });
});

describe('rate limiting (real MongoDB)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ AUTH_THROTTLE_LIMIT: '3', THROTTLE_LIMIT: '1000' });
  });
  afterAll(() => t.close());

  it('429 in the envelope after the strict auth limit; other routes unaffected', async () => {
    const agent = t.agent();
    const attempt = () => agent.post('/api/auth/signin').set('Origin', ORIGIN).send({ email: 'nobody@example.com', password: 'Whatever1!' });
    for (let i = 0; i < 3; i += 1) await attempt().expect(401);
    const limited = await attempt().expect(429);
    expect(limited.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests', message: 'Too many requests, please try again later' });
    await request(t.app.getHttpServer()).get('/api/health').expect(200);
  });
});
