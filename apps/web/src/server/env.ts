import { z } from 'zod';

/**
 * Configuration is validated once, at startup, rather than read ad hoc. A healthcare service
 * that boots with a missing encryption key and discovers it on first write has already failed.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  FIELD_ENCRYPTION_KEY: z.string().min(32, 'FIELD_ENCRYPTION_KEY must be at least 32 characters'),
  AI_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_TOKEN: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@gi-compass.invalid'),
  SMTP_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = (): boolean => env().NODE_ENV === 'production';
