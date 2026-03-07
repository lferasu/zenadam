import { logger } from '../config/logger.js';

const ingestionQueues = ['ingestion-rss', 'ingestion-api', 'ingestion-scraper'];

logger.info('Ingestion worker started', { ingestionQueues });

setInterval(() => {
  logger.info('Ingestion worker poll tick');
}, 20_000);
