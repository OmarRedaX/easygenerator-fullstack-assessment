import { Writable } from 'node:stream';
import pino from 'pino';
import { REDACT_PATHS } from './logging';

describe('log redaction', () => {
  it('never writes cookies, auth headers or passwords', () => {
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _enc, cb) { lines.push(String(chunk)); cb(); } });
    pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream).info(
      {
        req: { headers: { cookie: 'sid=SECRETCOOKIE', authorization: 'Bearer TOKEN123' }, body: { password: 'hunter2!' } },
        res: { headers: { 'set-cookie': ['sid=SECRETCOOKIE'] } },
        password: 'hunter2!',
        user: { password: 'hunter2!' },
      },
      'request',
    );
    const out = lines.join('');
    expect(out).not.toMatch(/SECRETCOOKIE|TOKEN123|hunter2/);
    expect(out).toContain('[REDACTED]');
  });
});
