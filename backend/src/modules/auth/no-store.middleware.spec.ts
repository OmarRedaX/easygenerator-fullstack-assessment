import type { NextFunction, Request, Response } from 'express';
import { noStoreMiddleware } from './no-store.middleware';

describe('noStoreMiddleware', () => {
  it('marks the response as not storable and passes the request on', () => {
    const setHeader = jest.fn();
    const next = jest.fn() as NextFunction;
    noStoreMiddleware({} as Request, { setHeader } as unknown as Response, next);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
