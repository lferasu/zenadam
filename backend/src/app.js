import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import apiRouter from './api/routes/index.js';
import { errorHandler, notFoundHandler } from './api/middlewares/error.middleware.js';
import { requestContextMiddleware } from './api/middlewares/request-context.middleware.js';
import { env } from './config/env.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));
  app.use(requestContextMiddleware);

  app.use(env.API_BASE_PATH, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
