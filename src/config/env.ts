import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z
      .string()
      .default('postgres://globetrotter_app:globetrotter_dev_password@localhost:5432/globetrotter'),
    JWT_ACCESS_SECRET: z.string().min(16).default('super-secret-jwt-key-min-32-chars-globetrotter-2026'),
    JWT_ACCESS_TTL_MINUTES: z.coerce.number().default(15),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
    PASSWORD_HASH_COST: z.coerce.number().default(12),
    PUBLIC_APP_BASE_URL: z.string().default('http://localhost:3000'),
    EMAIL_PROVIDER_API_KEY: z.string().optional().default('mock-api-key'),
    EMAIL_FROM_ADDRESS: z.string().default('noreply@globetrotter.local'),
    OBJECT_STORAGE_BUCKET: z.string().default('globetrotter-media'),
    OBJECT_STORAGE_ACCESS_KEY: z.string().optional().default('mock-access-key'),
    OBJECT_STORAGE_SECRET_KEY: z.string().optional().default('mock-secret-key'),
    OBJECT_STORAGE_ENDPOINT: z.string().optional().default('http://localhost:9000'),
    OBJECT_STORAGE_REGION: z.string().default('us-east-1'),
    RATE_LIMIT_ENABLED: z
      .string()
      .transform((v) => v === 'true' || v === '1')
      .default('true'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    CORS_ORIGIN: z.string().default('*'),
  })
  .passthrough();

export type Config = z.infer<typeof envSchema>;

let parsedConfig: Config;

try {
  parsedConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Invalid environment configuration:');
    for (const issue of error.issues) {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    }
  } else {
    console.error('Configuration error:', error);
  }
  process.exit(1);
}

export const config = parsedConfig;
