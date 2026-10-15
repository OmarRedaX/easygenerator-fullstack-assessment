import { z } from 'zod';

const PLACEHOLDER_FRAGMENTS = ['changeme', 'change-me', 'replace', 'secret', 'example', 'placeholder', 'your_', 'your-'];
export const SESSION_SECRET_MIN_BYTES = 32;

const sessionSecret = z.string().superRefine((value, ctx) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'must be base64 (generate with: openssl rand -base64 32)' });
    return;
  }
  if (Buffer.from(value, 'base64').length < SESSION_SECRET_MIN_BYTES) {
    ctx.addIssue({ code: 'custom', message: `must decode to at least ${SESSION_SECRET_MIN_BYTES} bytes` });
  }
  // Check both the raw string and its decoded form: base64 hides placeholder text (e.g. "replace-me...").
  const lower = `${value}
${Buffer.from(value, 'base64').toString('latin1')}`.toLowerCase();
  if (PLACEHOLDER_FRAGMENTS.some((p) => lower.includes(p)) || new Set(value).size < 16) {
    ctx.addIssue({ code: 'custom', message: 'looks like a placeholder or low-entropy value; generate a random one' });
  }
});

const corsOrigin = z.string().refine((v) => {
  try {
    return new URL(v).origin === v;
  } catch {
    return false;
  }
}, 'must be exactly one origin like http://localhost:5173 (no path, no trailing slash, no wildcard)');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\/.+/, 'must be a mongodb:// or mongodb+srv:// URI'),
  SESSION_SECRET: sessionSecret,
  // RFC 6265 cookie-name token; anything else would only fail later, when the first session cookie is serialised.
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/, 'must be a valid cookie name token').default('sid'),
  CORS_ORIGIN: corsOrigin,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().min(1).default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
