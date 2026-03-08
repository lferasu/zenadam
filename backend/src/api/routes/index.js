import { Router } from 'express';
import feedRouter from './feed.routes.js';
import healthRouter from './health.routes.js';

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(feedRouter);

export default apiRouter;
