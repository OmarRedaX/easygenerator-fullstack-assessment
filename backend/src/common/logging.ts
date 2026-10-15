import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'req.body.password',
  'password',
  '*.password',
];

export function buildPinoHttpOptions(level: string): Options {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    genReqId: (req: IncomingMessage) => (req as IncomingMessage & { requestId?: string }).requestId ?? randomUUID(),
    autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
  };
}
