import { logger } from '../config/logger.js';
import { closeMongoClient } from '../config/database.js';
import { ingestActiveSources } from '../services/sourceIngestionService.js';

const ingestionQueues = ['ingestion-rss', 'ingestion-api', 'ingestion-scraper'];
const isOnceMode = process.argv.includes('--once');

logger.info('Ingestion worker started', { ingestionQueues });

const runCycle = async () => {
  const ingestion = await ingestActiveSources();

  logger.info('Ingestion cycle completed', {
    ...ingestion.metrics
  });

  return ingestion;
};

if (isOnceMode) {
  runCycle()
    .catch((error) => {
      logger.error('Ingestion worker failed', { message: error.message });
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeMongoClient();
    });
} else {
  runCycle().catch((error) => {
    logger.error('Initial ingestion cycle failed', { message: error.message });
  });

  setInterval(() => {
    runCycle().catch((error) => {
      logger.error('Scheduled ingestion cycle failed', { message: error.message });
    });
  }, 20_000);
}
