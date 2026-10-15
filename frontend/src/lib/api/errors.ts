import type { FieldDetail } from './types';

/** A non-2xx answer from the server (or an unreadable 2xx body). */
export class ApiError extends Error {
  readonly status: number;
  readonly details: FieldDetail[] | undefined;
  /** Present only when the server supplied one (body `requestId` or `X-Request-Id` header). */
  readonly requestId: string | undefined;

  constructor(status: number, message: string, init: { details?: FieldDetail[]; requestId?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = init.details;
    this.requestId = init.requestId;
  }
}

/** The request never produced a response (offline, DNS, aborted). It has no status and no request reference. */
export class NetworkError extends Error {
  constructor(message = 'Network request failed', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NetworkError';
  }
}
