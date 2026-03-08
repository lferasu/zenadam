import { closeMongoClient } from '../config/database.js';
import { logger } from '../config/logger.js';
import { generateStoriesFromNormalizedItems } from '../services/storyService.js';

const run = async () => {
  const clustering = await generateStoriesFromNormalizedItems();
  logger.info('Story clustering completed', clustering);
};

run()
  .catch((error) => {
    logger.error('Clustering worker failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
