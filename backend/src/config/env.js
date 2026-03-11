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
  STORY_MAX_AGE_DAYS: Number(process.env.STORY_MAX_AGE_DAYS ?? 0),
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? 'zenadam_dev',
  AI_API_KEY: process.env.AI_API_KEY ?? '',
  AI_TRANSLATION_MODEL: process.env.AI_TRANSLATION_MODEL ?? '',
  AI_SUMMARY_MODEL: process.env.AI_SUMMARY_MODEL ?? '',
  AI_EMBEDDING_MODEL: process.env.AI_EMBEDDING_MODEL ?? '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  ZENADAM_EMBEDDING_MODEL: process.env.ZENADAM_EMBEDDING_MODEL ?? 'text-embedding-3-large',
  ZENADAM_ENTITY_EXTRACTION_MODEL: process.env.ZENADAM_ENTITY_EXTRACTION_MODEL ?? 'gpt-4o-mini',
  ZENADAM_TARGET_LANGUAGE: process.env.ZENADAM_TARGET_LANGUAGE ?? 'am',
  ZENADAM_ENABLE_NORMALIZATION: (process.env.ZENADAM_ENABLE_NORMALIZATION ?? 'true').toLowerCase() === 'true',
  ZENADAM_ENABLE_STORY_SUMMARY_REFRESH:
    (process.env.ZENADAM_ENABLE_STORY_SUMMARY_REFRESH ?? 'true').toLowerCase() === 'true',
  ZENADAM_NORMALIZATION_BATCH_LIMIT: Number(process.env.ZENADAM_NORMALIZATION_BATCH_LIMIT ?? 100),
  VECTOR_SEARCH_ENABLED: (process.env.VECTOR_SEARCH_ENABLED ?? 'true').toLowerCase() === 'true',
  VECTOR_SEARCH_INDEX_NAME: process.env.VECTOR_SEARCH_INDEX_NAME ?? 'normalized_item_embedding_index',
  VECTOR_NUM_CANDIDATES: Number(process.env.VECTOR_NUM_CANDIDATES ?? 100),
  CANDIDATE_WINDOW_HOURS: Number(process.env.CANDIDATE_WINDOW_HOURS ?? 72),
  CANDIDATE_FORWARD_WINDOW_HOURS: Number(process.env.CANDIDATE_FORWARD_WINDOW_HOURS ?? 6),
  MAX_CANDIDATE_ARTICLES: Number(process.env.MAX_CANDIDATE_ARTICLES ?? 200),
  MAX_NEAREST_ARTICLES: Number(process.env.MAX_NEAREST_ARTICLES ?? 10),
  SIMILARITY_STRONG_THRESHOLD: Number(process.env.SIMILARITY_STRONG_THRESHOLD ?? 0.72),
  SIMILARITY_BORDERLINE_THRESHOLD: Number(process.env.SIMILARITY_BORDERLINE_THRESHOLD ?? 0.7),
  QUEUE_BACKEND: process.env.QUEUE_BACKEND ?? 'mongodb',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  ADMIN_BASIC_AUTH_USER: process.env.ADMIN_BASIC_AUTH_USER ?? '',
  ADMIN_BASIC_AUTH_PASS: process.env.ADMIN_BASIC_AUTH_PASS ?? ''
};
