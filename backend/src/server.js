import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info('API server started', {
    port: env.PORT,
    apiBasePath: env.API_BASE_PATH,
    nodeEnv: env.NODE_ENV
  });
});
