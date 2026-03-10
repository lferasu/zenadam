import { Router } from 'express';
import { getStories, getStoriesWithItems, getStoryById, getStoryWithItemsById } from '../../controllers/stories.controller.js';

const storiesRouter = Router();

storiesRouter.get('/stories', getStories);
storiesRouter.get('/stories-with-items', getStoriesWithItems);
storiesRouter.get('/stories-with-items/:id', getStoryWithItemsById);
storiesRouter.get('/stories/:id', getStoryById);

export default storiesRouter;
