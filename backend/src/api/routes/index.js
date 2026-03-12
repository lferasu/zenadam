import { Router } from 'express';
import adminSourcesRouter from './adminSources.routes.js';
import feedRouter from './feed.routes.js';
import healthRouter from './health.routes.js';
import storiesRouter from './stories.routes.js';

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(feedRouter);
apiRouter.use(storiesRouter);
apiRouter.use(adminSourcesRouter);

export default apiRouter;
