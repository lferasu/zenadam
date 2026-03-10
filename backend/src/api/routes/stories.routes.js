import { Router } from 'express';
import { getStories, getStoryById } from '../../controllers/stories.controller.js';

const storiesRouter = Router();

storiesRouter.get('/stories', getStories);
storiesRouter.get('/stories/:id', getStoryById);

export default storiesRouter;
