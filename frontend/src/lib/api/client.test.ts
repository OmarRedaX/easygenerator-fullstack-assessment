import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request, setUnauthorizedHandler } from './client';
import { ApiError, NetworkError } from './errors';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to fail');
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe('request: transport', () => {
  it('calls /api + path with same-origin credentials and JSON accept', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await request('GET', '/auth/me');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/auth/me');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toMatchObject({ Accept: 'application/json' });
    expect(init?.headers).not.toHaveProperty('Content-Type');
  });

  // The API sends no Cache-Control, only an ETag. On Back/Forward the browser may then answer GET /auth/me from its
  // HTTP cache without asking the server, which showed the signed-in page after sign-out (seen in Chrome).
  it.each(['GET', 'POST'] as const)('opts every %s out of the browser HTTP cache', async (method) => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await request(method, '/auth/me');
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({ cache: 'no-store' });
  });

  it('sends a JSON body with a content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user: {} }, 201));
    await request('POST', '/auth/signup', { body: { email: 'a@b.co' } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(JSON.stringify({ email: 'a@b.co' }));
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('sends no body and no content type when there is no body (logout)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await request('POST', '/auth/logout');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBeUndefined();
    expect(init?.headers).not.toHaveProperty('Content-Type');
  });

  it('returns parsed JSON for 200/201 and undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { id: '1' } }, 201));
    await expect(request('POST', '/auth/signup', { body: {} })).resolves.toEqual({ user: { id: '1' } });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(request('POST', '/auth/logout')).resolves.toBeUndefined();
  });

  it('never sets Origin, Cookie or CSRF headers itself', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await request('POST', '/auth/signin', { body: {} });
    const headers = Object.keys(fetchMock.mock.calls[0]?.[1]?.headers ?? {}).map((h) => h.toLowerCase());
    expect(headers).not.toContain('origin');
    expect(headers).not.toContain('cookie');
    expect(headers).not.toContain('x-request-id');
  });
});

describe('request: errors', () => {
  it('maps the backend envelope to ApiError', async () => {
    const envelope = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      requestId: 'req-12345678',
      details: [{ field: 'email', messages: ['must be an email'] }],
    };
    fetchMock.mockResolvedValue(jsonResponse(envelope, 400));
    const error = await failure(request('POST', '/auth/signup', { body: {} }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Validation failed',
      requestId: 'req-12345678',
      details: [{ field: 'email', messages: ['must be an email'] }],
    });
  });

  it('falls back to the X-Request-Id header when the body has no requestId', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'nope' }, 500, { 'X-Request-Id': 'hdr-87654321' }));
    const error = await failure(request('GET', '/auth/me'));
    expect(error).toMatchObject({ status: 500, message: 'nope', requestId: 'hdr-87654321' });
  });

  it('survives a non-JSON error body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await failure(request('GET', '/auth/me'));
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Request failed');
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).requestId).toBeUndefined();
  });

  it('survives an empty error body and a body without message', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect(await failure(request('GET', '/health'))).toMatchObject({ status: 503, message: 'Request failed' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ requestId: 'r-1234567' }, 500));
    expect(await failure(request('GET', '/health'))).toMatchObject({ message: 'Request failed', requestId: 'r-1234567' });
  });

  it('ignores a malformed details array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'x', details: 'nope' }, 400));
    const error = (await failure(request('POST', '/auth/signup', { body: {} }))) as ApiError;
    expect(error.details).toBeUndefined();
  });

  it('treats an unreadable 2xx body as a failed request', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    expect(await failure(request('GET', '/auth/me'))).toMatchObject({ status: 200, message: 'Request failed' });
  });

  it('wraps a rejected fetch in NetworkError without a request reference', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await failure(request('GET', '/auth/me'));
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).not.toHaveProperty('requestId');
  });
});

describe('request: unauthorized handler', () => {
  it('is called for a 401 by default', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({ message: 'no' }, 401));
    await failure(request('POST', '/auth/logout'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is not called when the request opts out (sign-in, sign-up, me)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(jsonResponse({ message: 'no' }, 401));
    await failure(request('GET', '/auth/me', { notifyUnauthorized: false }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('is not called for other statuses or successes', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'x' }, 403));
    await failure(request('POST', '/auth/logout'));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));
    await request('GET', '/auth/me');
    expect(handler).not.toHaveBeenCalled();
  });

  it('still throws the ApiError when no handler is registered', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'no' }, 401));
    expect(await failure(request('POST', '/auth/logout'))).toMatchObject({ status: 401 });
  });
});
