import { closeMongoClient } from '../config/database.js';
import { logger } from '../config/logger.js';
import { ensureDefaultSources } from '../services/sourceService.js';

const run = async () => {
  const seedResult = await ensureDefaultSources();

  logger.info('Source seed completed', {
    created: seedResult.created,
    slug: seedResult.source?.slug
  });
};

run()
  .catch((error) => {
    logger.error('Source seed failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
