import type { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

function run(header?: string) {
  const req = { headers: header === undefined ? {} : { 'x-request-id': header } } as unknown as Request;
  const setHeader = jest.fn();
  const next = jest.fn() as NextFunction;
  requestIdMiddleware(req, { setHeader } as unknown as Response, next);
  return { req, setHeader, next };
}

describe('requestIdMiddleware', () => {
  it('keeps a well-formed client id and echoes it', () => {
    const { req, setHeader, next } = run('abc12345-req');
    expect(req.requestId).toBe('abc12345-req');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc12345-req');
    expect(next).toHaveBeenCalled();
  });
  it.each(['short', 'has spaces in it!', 'x'.repeat(65), 'line\nbreak-injection'])('replaces unsafe id %j', (bad) => {
    const { req } = run(bad);
    expect(req.requestId).not.toBe(bad);
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('generates an id when none is sent', () => {
    expect(run().req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
