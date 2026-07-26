import dotenv from 'dotenv';
import path from 'path';

const repoEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

// The repository-level .env is the primary configuration used by the root scripts.
// Keep server/.env as a fallback for existing deployments.
dotenv.config({ path: repoEnvPath });
dotenv.config({ path: serverEnvPath });

export const config = {
  port: Number(process.env.PORT || 3000),
  trustProxy: process.env.TRUST_PROXY === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisPrefix: process.env.REDIS_PREFIX || 'lolguess:',
  redisRequired: process.env.REDIS_REQUIRED === 'true' || process.env.NODE_ENV === 'production',
  redisCommandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 1500),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
