import { Router } from 'express';
import {
  getStories,
  getStoryArticles,
  getStoryById,
  getStoriesInspection,
  getStoryInspectionById
} from '../../controllers/stories.controller.js';

const storiesRouter = Router();

storiesRouter.get('/stories/inspection', getStoriesInspection);
storiesRouter.get('/stories/inspection/:id', getStoryInspectionById);
storiesRouter.get('/stories', getStories);
storiesRouter.get('/stories/:storyId/articles', getStoryArticles);
storiesRouter.get('/stories/:storyId', getStoryById);

export default storiesRouter;
