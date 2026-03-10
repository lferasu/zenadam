import {
  getAllStoriesWithItemTitles,
  getStoriesForInspection,
  getStoryForInspectionById,
  getStoryWithAllItemTitlesById
} from '../services/storyService.js';

const parsePositiveInt = ({ raw, defaultValue, minimum = 1, maximum = Number.MAX_SAFE_INTEGER, errorCode, errorMessage }) => {
  const value = Number(raw ?? defaultValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    const error = new Error(errorMessage);
    error.code = errorCode;
    error.statusCode = 400;
    throw error;
  }

  return value;
};

const parseBoolean = (raw) => {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw === 'boolean') {
    return raw;
  }

  if (raw === 'true') {
    return true;
  }

  if (raw === 'false') {
    return false;
  }

  const error = new Error('Invalid boolean query parameter');
  error.code = 'INVALID_BOOLEAN_PARAM';
  error.statusCode = 400;
  throw error;
};

export const getStories = async (req, res, next) => {
  try {
    const page = parsePositiveInt({
      raw: req.query.page,
      defaultValue: 1,
      maximum: 10_000,
      errorCode: 'INVALID_PAGE',
      errorMessage: 'page must be a positive integer'
    });

    const limit = parsePositiveInt({
      raw: req.query.limit,
      defaultValue: 25,
      maximum: 100,
      errorCode: 'INVALID_LIMIT',
      errorMessage: 'limit must be an integer between 1 and 100'
    });

    const hasSummary = parseBoolean(req.query.hasSummary);

    let minArticleCount;
    if (req.query.minArticleCount !== undefined) {
      minArticleCount = parsePositiveInt({
        raw: req.query.minArticleCount,
        defaultValue: 1,
        maximum: 100_000,
        errorCode: 'INVALID_MIN_ARTICLE_COUNT',
        errorMessage: 'minArticleCount must be a positive integer'
      });
    }

    const stories = await getStoriesForInspection({
      page,
      limit,
      sort: req.query.sort,
      hasSummary,
      minArticleCount
    });

    res.json({
      data: stories.items,
      meta: {
        requestId: req.requestId,
        pagination: stories.pagination
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const getStoryById = async (req, res, next) => {
  try {
    const debug = parseBoolean(req.query.debug) ?? false;
    const story = await getStoryForInspectionById({ id: req.params.id, debug });

    res.json({
      data: story,
      meta: {
        requestId: req.requestId,
        debug
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};


export const getStoriesWithItems = async (req, res, next) => {
  try {
    const stories = await getAllStoriesWithItemTitles();

    res.json({
      data: stories,
      meta: {
        requestId: req.requestId,
        total: stories.length
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};

export const getStoryWithItemsById = async (req, res, next) => {
  try {
    const story = await getStoryWithAllItemTitlesById({ id: req.params.id });

    res.json({
      data: story,
      meta: {
        requestId: req.requestId
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
};
