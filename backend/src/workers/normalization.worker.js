import { closeMongoClient } from '../config/database.js';
import { logger } from '../config/logger.js';
import { normalizePendingSourceItems } from '../services/normalizationService.js';

const run = async () => {
  const normalization = await normalizePendingSourceItems();

  logger.info('Normalization completed', normalization);
};

run()
  .catch((error) => {
    logger.error('Normalization worker failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
