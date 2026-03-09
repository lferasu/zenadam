import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support execution from backend/ while keeping root .env as fallback.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  API_BASE_PATH: process.env.API_BASE_PATH ?? '/api/v1',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? 'zenadam_dev',
  AI_API_KEY: process.env.AI_API_KEY ?? '',
  AI_TRANSLATION_MODEL: process.env.AI_TRANSLATION_MODEL ?? '',
  AI_SUMMARY_MODEL: process.env.AI_SUMMARY_MODEL ?? '',
  AI_EMBEDDING_MODEL: process.env.AI_EMBEDDING_MODEL ?? '',
  QUEUE_BACKEND: process.env.QUEUE_BACKEND ?? 'mongodb',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  ADMIN_BASIC_AUTH_USER: process.env.ADMIN_BASIC_AUTH_USER ?? '',
  ADMIN_BASIC_AUTH_PASS: process.env.ADMIN_BASIC_AUTH_PASS ?? ''
};
