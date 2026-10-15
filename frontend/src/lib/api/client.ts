import { ApiError, NetworkError } from './errors';
import type { FieldDetail } from './types';

/** Same-origin base path. Proxies (Vite in dev, nginx in production) must preserve this prefix. */
export const API_BASE = '/api';

const FALLBACK_MESSAGE = 'Request failed';

let onUnauthorized: (() => void) | null = null;

/** Registered once by the app; invoked for 401 answers that did not opt out via `notifyUnauthorized: false`. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  body?: unknown;
  /** Set to false where a 401 is an expected answer (sign-in, sign-up, the session check). Default true. */
  notifyUnauthorized?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDetails(value: unknown): FieldDetail[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const details: FieldDetail[] = [];
  for (const item of value as unknown[]) {
    if (isRecord(item) && typeof item.field === 'string' && Array.isArray(item.messages)) {
      const messages = (item.messages as unknown[]).filter((m): m is string => typeof m === 'string');
      details.push({ field: item.field, messages });
    }
  }
  return details;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    body = undefined;
  }
  const record = isRecord(body) ? body : {};
  const headerId = response.headers.get('X-Request-Id') ?? undefined;
  const requestId = typeof record.requestId === 'string' ? record.requestId : headerId;
  const details = parseDetails(record.details);
  return new ApiError(
    response.status,
    typeof record.message === 'string' && record.message !== '' ? record.message : FALLBACK_MESSAGE,
    {
      ...(details ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  );
}

export async function request<T = undefined>(
  method: 'GET' | 'POST',
  path: string,
  { body, notifyUnauthorized = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const init: RequestInit = { method, credentials: 'same-origin', headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (cause) {
    throw new NetworkError('Network request failed', { cause });
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (response.status === 401 && notifyUnauthorized) onUnauthorized?.();
    throw error;
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, FALLBACK_MESSAGE);
  }
}
