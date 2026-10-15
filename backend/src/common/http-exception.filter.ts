import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { DuplicateEmailError } from '../modules/users/errors';
import './request.types';

export interface ErrorDetail {
  field: string;
  messages: string[];
}

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: ErrorDetail[];
  requestId: string;
}

interface Normalized {
  statusCode: number;
  message: string;
  details?: ErrorDetail[];
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.too.large': 'Request body too large',
  'entity.parse.failed': 'Malformed JSON body',
};

function normalize(exception: unknown): Normalized {
  if (exception instanceof DuplicateEmailError) return { statusCode: HttpStatus.CONFLICT, message: exception.message };

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return { statusCode, message: 'Too many requests, please try again later' };
    }
    const body = exception.getResponse();
    if (typeof body === 'string') return { statusCode, message: body };
    const { message, details } = body as { message?: string | string[]; details?: ErrorDetail[] };
    return {
      statusCode,
      message: Array.isArray(message) ? message.join('; ') : (message ?? exception.message),
      ...(details ? { details } : {}),
    };
  }

  // Express/body-parser errors (malformed JSON, payload too large) are not HttpExceptions.
  const http = (exception ?? {}) as { status?: unknown; statusCode?: unknown; type?: unknown; expose?: unknown };
  const status = typeof http.status === 'number' ? http.status : typeof http.statusCode === 'number' ? http.statusCode : undefined;
  if (status !== undefined && status >= 400 && status < 500 && http.expose === true) {
    return { statusCode: status, message: (typeof http.type === 'string' && BODY_PARSER_MESSAGES[http.type]) || 'Bad request' };
  }

  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    if (res.headersSent) return;

    const { statusCode, message, details } = normalize(exception);
    if (statusCode >= 500) {
      this.logger.error(`${req.method} ${req.originalUrl} failed [${req.requestId}]`, exception instanceof Error ? exception.stack : String(exception));
    }
    const body: ErrorBody = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...(details ? { details } : {}),
      requestId: req.requestId,
    };
    res.status(statusCode).json(body);
  }
}
