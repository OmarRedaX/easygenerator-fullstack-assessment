import { request } from './client';
import { ApiError } from './errors';
import type { User, UserEnvelope } from './types';

export interface SignUpRequest {
  email: string;
  name: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export async function signUp(input: SignUpRequest): Promise<User> {
  const { user } = await request<UserEnvelope>('POST', '/auth/signup', { body: input, notifyUnauthorized: false });
  return user;
}

export async function signIn(input: SignInRequest): Promise<User> {
  const { user } = await request<UserEnvelope>('POST', '/auth/signin', { body: input, notifyUnauthorized: false });
  return user;
}

export async function logout(): Promise<void> {
  await request('POST', '/auth/logout');
}

export async function getMe(): Promise<User> {
  const { user } = await request<UserEnvelope>('GET', '/auth/me', { notifyUnauthorized: false });
  return user;
}

/** The session check: a 401 means "signed out", which is a normal result, not an error. */
export async function getMeOrNull(): Promise<User | null> {
  try {
    return await getMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
