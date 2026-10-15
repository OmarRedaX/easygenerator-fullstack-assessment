import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '../../lib/api/errors';
import { toFormFeedback } from './formErrors';

const GENERIC = 'Something went wrong. Try again.';

describe('toFormFeedback: sign-in', () => {
  it('shows one generic message for 401', () => {
    expect(toFormFeedback(new ApiError(401, 'Invalid email or password'), 'signin')).toEqual({
      message: 'Invalid email or password.',
      fieldErrors: {},
    });
  });
});

describe('toFormFeedback: sign-up', () => {
  it('puts a 409 on the email field and shows no form message', () => {
    expect(toFormFeedback(new ApiError(409, 'Email already registered'), 'signup')).toEqual({
      fieldErrors: { email: 'That email is already registered.' },
    });
  });

  it('maps 400 details onto their fields (first message each)', () => {
    const error = new ApiError(400, 'Validation failed', {
      details: [
        { field: 'email', messages: ['email must be an email', 'second'] },
        { field: 'password', messages: ['too weak'] },
      ],
    });
    expect(toFormFeedback(error, 'signup')).toEqual({
      fieldErrors: { email: 'email must be an email', password: 'too weak' },
    });
  });

  it('shows details for fields the form does not have in the form message', () => {
    const error = new ApiError(400, 'Validation failed', {
      details: [
        { field: 'name', messages: ['name is too short'] },
        { field: 'nickname', messages: ['not allowed'] },
      ],
    });
    expect(toFormFeedback(error, 'signup')).toEqual({
      message: 'nickname: not allowed',
      fieldErrors: { name: 'name is too short' },
    });
  });

  it('shows the server message for 400 without details and for 413', () => {
    expect(toFormFeedback(new ApiError(400, 'Malformed JSON body', { requestId: 'req-1' }), 'signup')).toEqual({
      message: 'Malformed JSON body',
      requestId: 'req-1',
      fieldErrors: {},
    });
    expect(toFormFeedback(new ApiError(413, 'Payload too large'), 'signin')).toMatchObject({
      message: 'Payload too large',
    });
  });
});

describe('toFormFeedback: shared statuses', () => {
  it.each(['signin', 'signup'] as const)('403 on %s', (context) => {
    expect(toFormFeedback(new ApiError(403, 'Forbidden'), context).message).toBe(
      'This request was blocked. Reload the page and try again.',
    );
  });

  it.each(['signin', 'signup'] as const)('429 on %s', (context) => {
    expect(toFormFeedback(new ApiError(429, 'ThrottlerException'), context).message).toBe(
      'Too many attempts. Try again in a minute.',
    );
  });

  it.each([500, 502, 503, 404, 418])('%i never leaks the server text', (status) => {
    const feedback = toFormFeedback(new ApiError(status, 'stack trace /srv/app.js:12'), 'signin');
    expect(feedback.message).toBe(GENERIC);
    expect(feedback.fieldErrors).toEqual({});
  });

  it('network errors are generic and carry no reference', () => {
    const feedback = toFormFeedback(new NetworkError(), 'signup');
    expect(feedback.message).toBe(GENERIC);
    expect(feedback.requestId).toBeUndefined();
  });

  it('unknown thrown values are generic', () => {
    expect(toFormFeedback('boom', 'signin').message).toBe(GENERIC);
  });
});

describe('toFormFeedback: request reference', () => {
  it('is copied through only when the server supplied one', () => {
    expect(toFormFeedback(new ApiError(500, 'x', { requestId: 'req-abcdef12' }), 'signin').requestId).toBe(
      'req-abcdef12',
    );
    expect(toFormFeedback(new ApiError(500, 'x'), 'signin')).not.toHaveProperty('requestId');
  });
});

describe('toFormFeedback: logout', () => {
  it.each([403, 429, 500])('%i uses the sign-out failure copy', (status) => {
    expect(toFormFeedback(new ApiError(status, 'x', { requestId: 'req-1' }), 'logout')).toEqual({
      message: "Couldn't sign you out. Try again.",
      requestId: 'req-1',
      fieldErrors: {},
    });
  });

  it('network failure uses the same copy without a reference', () => {
    expect(toFormFeedback(new NetworkError(), 'logout')).toEqual({
      message: "Couldn't sign you out. Try again.",
      fieldErrors: {},
    });
  });
});
