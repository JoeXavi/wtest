import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  AWS_REGION: z.string().default('us-east-1'),
  TABLE_NAME: z.string().min(1),
  DYNAMODB_ENDPOINT: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  PSP_BASE_URL: z.string().url(),
  PSP_PUBLIC_KEY: z.string().min(1),
  PSP_PRIVATE_KEY: z.string().min(1),
  PSP_INTEGRITY_SECRET: z.string().min(1),
  PSP_EVENTS_SECRET: z.string().min(1),
  PRICING_BASE_FEE_CENTS: z.coerce.number().int().nonnegative().default(150000),
  PRICING_DELIVERY_FEE_CENTS: z.coerce.number().int().nonnegative().default(800000),
  RESERVATION_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  API_TOKEN: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}
