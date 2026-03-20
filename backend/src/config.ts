import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    enabled: process.env.TELEGRAM_BOT_ENABLED !== 'false',
  },
  upload: {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    maxFileSize: 20 * 1024 * 1024, // 20MB
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  multiTenant: process.env.MULTI_TENANT === 'true',
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
  /** Service account JSON path for Google Cloud Vision (invoice OCR). See GOOGLE_APPLICATION_CREDENTIALS. */
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  debug: process.env.DEBUG === 'true',
} as const;
