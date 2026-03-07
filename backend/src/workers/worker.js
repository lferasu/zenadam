import { logger } from '../config/logger.js';

const queues = [
  'ingestion-rss',
  'ingestion-api',
  'ingestion-scraper',
  'translation',
  'summarization',
  'embedding',
  'clustering',
  'story-ranking-refresh',
  'story-summary-refresh'
];

logger.info('Zenadam generic worker started', { queues });

setInterval(() => {
  logger.info('Worker heartbeat', { queues });
}, 30_000);
