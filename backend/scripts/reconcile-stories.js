import { closeMongoClient } from '../src/config/database.js';
import { logger } from '../src/config/logger.js';
import { reconcileStories } from '../src/tools/storyReconcile.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');

const getArgValue = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  if (!match) {
    return fallback;
  }

  return match.split('=')[1];
};

const lookbackDays = Number(getArgValue('lookback-days', 7));
const limit = Number(getArgValue('limit', 200));
const strongThreshold = Number(getArgValue('strong-threshold', Number.NaN));

const run = async () => {
  const { report, reportPath } = await reconcileStories({
    apply,
    lookbackDays,
    limit,
    strongThreshold: Number.isFinite(strongThreshold) ? strongThreshold : undefined
  });

  console.table(
    report.actions.slice(0, 50).map((action) => ({
      sourceStoryId: action.sourceStoryId,
      targetStoryId: action.targetStoryId ?? '-',
      action: action.action,
      score: action.score ? Number(action.score.toFixed(4)) : '-',
      reason: action.reason ?? '-'
    }))
  );

  if (!apply) {
    logger.warn('Dry-run only. Re-run with --apply to merge stories.');
  }

  logger.info('Story reconciliation report written', { reportPath });
};

run()
  .catch((error) => {
    logger.error('Story reconciliation failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
