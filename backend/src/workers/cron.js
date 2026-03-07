import { logger } from '../config/logger.js';

logger.info('Cron entrypoint triggered', {
  tasks: ['poll-sources', 'refresh-story-hotness', 'refresh-story-summaries']
});
