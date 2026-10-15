import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Nest turns body-parser's SyntaxError into `BadRequestException(err.message)`, which loses `type` and leaks the
 * parser's wording. Re-map malformed JSON here (right after the body parser) so it reaches HttpExceptionFilter with a
 * stable message. Other errors (e.g. 413 entity.too.large) pass through untouched.
 */
export function bodyParserErrorMiddleware(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  if ((err as { type?: unknown } | null)?.type === 'entity.parse.failed') {
    next(new BadRequestException('Malformed JSON body'));
    return;
  }
  next(err);
}
