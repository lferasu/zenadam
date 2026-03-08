import { getFeedStories } from '../services/storyService.js';

export const getFeed = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 25);
    const stories = await getFeedStories({ limit: Number.isNaN(limit) ? 25 : limit });

    res.json({ stories });
  } catch (error) {
    next(error);
  }
};
