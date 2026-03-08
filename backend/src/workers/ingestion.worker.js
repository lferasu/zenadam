import { logger } from '../config/logger.js';
import { closeMongoClient } from '../config/database.js';
import { ingestActiveRssSources } from '../services/sourceIngestionService.js';
import { ensureDefaultSources } from '../services/sourceService.js';

const ingestionQueues = ['ingestion-rss', 'ingestion-api', 'ingestion-scraper'];
const isOnceMode = process.argv.includes('--once');

logger.info('Ingestion worker started', { ingestionQueues });

const runCycle = async () => {
  const sourceSeed = await ensureDefaultSources();
  const ingestion = await ingestActiveRssSources();

  logger.info('Ingestion cycle completed', {
    sourceSeedCreated: sourceSeed.created,
    sourcesProcessed: ingestion.length
  });
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
