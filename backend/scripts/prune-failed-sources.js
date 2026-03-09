import { closeMongoClient } from '../src/config/database.js';
import { logger } from '../src/config/logger.js';
import { pruneFailedSources } from '../src/tools/sourcePrune.js';

const apply = process.argv.includes('--apply');

const run = async () => {
  const { pruneReport, reportPath } = await pruneFailedSources({
    apply,
    writeBack: true
  });

  console.table(
    pruneReport.failedSources.map((source) => ({
      slug: source.slug,
      type: source.type,
      reason: source.reason
    }))
  );

  if (!apply) {
    logger.warn('Dry-run only. Re-run with --apply to delete failed sources.');
  }

  logger.info('Source prune report written', { reportPath });
};

run()
  .catch((error) => {
    logger.error('Source prune failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
