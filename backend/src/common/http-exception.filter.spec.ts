import { ArgumentsHost, BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { DuplicateEmailError } from '../modules/users/errors';
import { HttpExceptionFilter } from './http-exception.filter';

function invoke(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: '/api/x', requestId: 'req-1234567' }),
      getResponse: () => ({ status, headersSent: false }),
    }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0] as number, body: json.mock.calls[0]?.[0] as Record<string, unknown> };
}

describe('HttpExceptionFilter', () => {
  it('maps DuplicateEmailError to 409', () => {
    const { status, body } = invoke(new DuplicateEmailError());
    expect(status).toBe(409);
    expect(body).toEqual({ statusCode: 409, error: 'Conflict', message: 'Email already registered', requestId: 'req-1234567' });
  });
  it('keeps validation details', () => {
    const details = [{ field: 'email', messages: ['email must be an email'] }];
    const { status, body } = invoke(new BadRequestException({ message: 'Validation failed', details }));
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'Bad Request', message: 'Validation failed', details });
  });
  it('maps 401 and 403 passthrough', () => {
    expect(invoke(new UnauthorizedException('Invalid email or password')).body).toMatchObject({
      statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password',
    });
  });
  it('normalises throttling to a fixed 429 message', () => {
    const { status, body } = invoke(new HttpException('ThrottlerException: Too Many Requests', 429));
    expect(status).toBe(429);
    expect(body.message).toBe('Too many requests, please try again later');
  });
  it.each([
    ['entity.too.large', 413, 'Request body too large'],
    ['entity.parse.failed', 400, 'Malformed JSON body'],
  ])('maps body-parser error %s', (type, code, message) => {
    const { status, body } = invoke({ type, status: code, expose: true });
    expect(status).toBe(code);
    expect(body.message).toBe(message);
  });
  it('hides internals of unexpected errors', () => {
    const { status, body } = invoke(new Error('connection string mongodb://user:pw@host leaked'));
    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, error: 'Internal Server Error', message: 'Internal server error', requestId: 'req-1234567' });
    expect(JSON.stringify(body)).not.toMatch(/mongodb:|stack/);
  });
});
