import { closeMongoClient } from '../config/database.js';
import { logger } from '../config/logger.js';
import { runBackendSlicePipeline } from '../services/pipelineService.js';

const run = async () => {
  const result = await runBackendSlicePipeline();

  logger.info('Backend slice pipeline completed', {
    sourceSeedCreated: result.sourceSeed.created,
    sourceIngestionCount: result.ingestion.length,
    normalizedCount: result.normalization.normalizedCount,
    storiesGenerated: result.clustering.generated
  });
};

run()
  .catch((error) => {
    logger.error('Pipeline worker failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
