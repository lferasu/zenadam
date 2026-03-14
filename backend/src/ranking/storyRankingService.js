import { ObjectId } from 'mongodb';
import {
  findStoryForRanking,
  updateStoryPrimaryArticle,
  updateStoryRanking
} from '../repositories/storyRepository.js';
import { STORY_SORT_MODES } from './constants.js';
import { rankStoryItems } from './storyItemRankingPolicy.js';
import { calculateStoryRanking } from './storyRankingPolicy.js';

export const normalizeStorySort = (sort) => {
  if (!sort) {
    return STORY_SORT_MODES.RELEVANT;
  }

  if (sort === STORY_SORT_MODES.LATEST || sort === STORY_SORT_MODES.RELEVANT) {
    return sort;
  }

  const error = new Error('sort must be one of: latest, relevant');
  error.code = 'INVALID_STORY_SORT';
  error.statusCode = 400;
  throw error;
};

export const refreshStoryRanking = async ({ storyId, deps = {}, context = {} }) => {
  const resolved = {
    findStoryForRanking: deps.findStoryForRanking ?? findStoryForRanking,
    updateStoryRanking: deps.updateStoryRanking ?? updateStoryRanking,
    updateStoryPrimaryArticle: deps.updateStoryPrimaryArticle ?? updateStoryPrimaryArticle
  };

  const story = await resolved.findStoryForRanking({ storyId });
  if (!story) {
    return { refreshed: false, reason: 'story_not_found' };
  }

  const rankedItems = rankStoryItems(story.items ?? [], story, context);
  const ranking = calculateStoryRanking(story, rankedItems, context);
  const primaryItem = rankedItems.find((item) => item.storyItemRanking?.isPrimary);

  await resolved.updateStoryRanking({
    storyId,
    ranking
  });

  await resolved.updateStoryPrimaryArticle({
    storyId,
    primaryArticleId: primaryItem?._id ?? null
  });

  return {
    refreshed: true,
    ranking,
    primaryArticleId: primaryItem?._id ? String(primaryItem._id) : null
  };
};

export const rankStoryItemsForResponse = ({ story, items, context = {} }) => rankStoryItems(items, story, context);

export const isValidObjectId = (value) => ObjectId.isValid(value);
