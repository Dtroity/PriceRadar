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
};
