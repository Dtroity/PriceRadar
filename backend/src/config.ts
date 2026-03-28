import dotenv from 'dotenv';

dotenv.config();

function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

const telegramBotToken = firstNonEmpty(
  process.env.TELEGRAM_BOT_TOKEN,
  process.env.TELEGRAM_TOKEN,
  process.env.TELEGRAM_API_TOKEN,
  process.env.BOT_TOKEN
);

/** If token is set, bot runs unless TELEGRAM_BOT_ENABLED=false. If no token, never run. */
const telegramExplicitDisabled = process.env.TELEGRAM_BOT_ENABLED === 'false';
const telegramEnabled = Boolean(telegramBotToken) && !telegramExplicitDisabled;

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
    botToken: telegramBotToken,
    enabled: telegramEnabled,
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
