import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  PII_ENCRYPTION_KEY: z.string().min(1),

  // HuggingFace (RMBG-2.0 배경 제거)
  HF_ACCESS_TOKEN: z.string().min(1),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().default('https://pub-beauty.r2.dev'),

  // Meta / Instagram
  META_APP_ID: z.string().default('not-configured'),
  META_APP_SECRET: z.string().default('not-configured'),
  META_REDIRECT_URI: z.string().default('http://localhost:3001/v1/meta/callback'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('*'),

  // Admin
  ADMIN_SECRET: z.string().default('change-me-in-production'),

  // 결제는 앱마켓 등록 후 활성화
  REVENUECAT_WEBHOOK_SECRET: z.string().default('not-configured'),
  PORTONE_API_SECRET: z.string().default('not-configured'),
  PORTONE_WEBHOOK_SECRET: z.string().default('not-configured'),
  PORTONE_STORE_ID: z.string().default('not-configured'),
});

export const config = schema.parse(process.env);
export type Config = z.infer<typeof schema>;
