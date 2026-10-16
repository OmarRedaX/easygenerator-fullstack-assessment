import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMe, getMeOrNull, logout, signIn, signUp } from './auth';
import { request } from './client';
import { ApiError, NetworkError } from './errors';
import type { User } from './types';

vi.mock('./client', () => ({ request: vi.fn() }));
const requestMock = vi.mocked(request);

const user: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

beforeEach(() => {
  requestMock.mockReset();
});

describe('auth API', () => {
  it('signUp posts the details and unwraps the user', async () => {
    requestMock.mockResolvedValue({ user });
    const input = { email: 'ada@example.com', name: 'Ada', password: 'Abcdef1!' };
    await expect(signUp(input)).resolves.toEqual(user);
    expect(requestMock).toHaveBeenCalledWith('POST', '/auth/signup', { body: input, notifyUnauthorized: false });
  });

  it('signIn posts the credentials and unwraps the user', async () => {
    requestMock.mockResolvedValue({ user });
    const input = { email: 'ada@example.com', password: 'x' };
    await expect(signIn(input)).resolves.toEqual(user);
    expect(requestMock).toHaveBeenCalledWith('POST', '/auth/signin', { body: input, notifyUnauthorized: false });
  });

  it('logout posts with no body and keeps the default 401 notification', async () => {
    requestMock.mockResolvedValue(undefined);
    await expect(logout()).resolves.toBeUndefined();
    expect(requestMock).toHaveBeenCalledWith('POST', '/auth/logout');
  });

  it('getMe reads /auth/me without notifying on 401', async () => {
    requestMock.mockResolvedValue({ user });
    await expect(getMe()).resolves.toEqual(user);
    expect(requestMock).toHaveBeenCalledWith('GET', '/auth/me', { notifyUnauthorized: false });
  });
});

describe('getMeOrNull', () => {
  it('returns the user when signed in', async () => {
    requestMock.mockResolvedValue({ user });
    await expect(getMeOrNull()).resolves.toEqual(user);
  });

  it('turns a 401 into null (a normal signed-out result)', async () => {
    requestMock.mockRejectedValue(new ApiError(401, 'Unauthorized'));
    await expect(getMeOrNull()).resolves.toBeNull();
  });

  it('rethrows anything else', async () => {
    const serverError = new ApiError(500, 'boom');
    requestMock.mockRejectedValueOnce(serverError);
    await expect(getMeOrNull()).rejects.toBe(serverError);
    const network = new NetworkError('offline');
    requestMock.mockRejectedValueOnce(network);
    await expect(getMeOrNull()).rejects.toBe(network);
  });
});
