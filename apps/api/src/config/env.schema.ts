import { z } from 'zod';

const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(10),
  DATABASE_URL_TEST: z.string().min(10).optional(),
  TAX_ENCRYPTION_MASTER_KEY_HEX: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TAX_ENCRYPTION_MASTER_KEY_HEX debe tener 64 caracteres hex (32 bytes)'),
  KYC_DOCUMENT_ENCRYPTION_KEY_HEX: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'KYC_DOCUMENT_ENCRYPTION_KEY_HEX debe tener 64 caracteres hex (32 bytes)'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_PEPPER: z.string().min(32),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  KYC_STORAGE_DIR: z.string().min(1).default('./storage/kyc'),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
});

export type ApiEnvConfig = z.infer<typeof ApiEnvSchema>;

let cachedEnv: ApiEnvConfig | null = null;

export function loadApiEnv(overrides?: Partial<Record<string, string>>): ApiEnvConfig {
  if (cachedEnv && !overrides) {
    return cachedEnv;
  }
  const parsed = ApiEnvSchema.safeParse({
    ...process.env,
    ...(overrides ?? {}),
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`[Configuración Inválida en @wave/api]: ${issues}`);
  }

  if (!overrides) {
    cachedEnv = parsed.data;
  }
  return parsed.data;
}
