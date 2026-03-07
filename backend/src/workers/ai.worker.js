import { logger } from '../config/logger.js';

const aiQueues = ['translation', 'summarization', 'embedding', 'clustering'];

logger.info('AI pipeline worker started', { aiQueues });

setInterval(() => {
  logger.info('AI worker poll tick');
}, 20_000);
