'use strict';

const path = require('path');

const backendRoot = path.resolve(__dirname, '../..');

require('dotenv').config({ path: path.join(backendRoot, '.env') });
require('dotenv').config({ path: path.join(backendRoot, '.env.test'), override: true });

process.env.NODE_ENV = 'test';
process.env.MULTI_TENANT ??= 'true';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-do-not-use-in-prod';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-do-not-use-in-prod';
process.env.LOG_LEVEL ??= 'error';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';
