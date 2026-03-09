import { closeMongoClient } from '../src/config/database.js';
import { logger } from '../src/config/logger.js';
import { printAuditSummary, runSourceAudit } from '../src/tools/sourceAudit.js';

const writeBack = process.argv.includes('--write-back');

const run = async () => {
  const { reportPath, report } = await runSourceAudit({ writeBack });
  printAuditSummary(report);

  logger.info('Source audit report written', {
    reportPath,
    writeBack
  });
};

run()
  .catch((error) => {
    logger.error('Source audit failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
