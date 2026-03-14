export const STORY_RANKING_STRATEGY_VERSION = 'story-ranking-v1';

export const STORY_RANKING_WEIGHTS = Object.freeze({
  recencyScore: 0.4,
  sourceRankScore: 0.2,
  popularityScore: 0.15,
  diversityScore: 0.15,
  velocityScore: 0.1
});

export const STORY_ITEM_RANKING_WEIGHTS = Object.freeze({
  sourceRankScore: 0.35,
  recencyScore: 0.25,
  centralityScore: 0.25,
  completenessScore: 0.15
});

export const STORY_SORT_MODES = Object.freeze({
  RELEVANT: 'relevant',
  LATEST: 'latest'
});

export const STORY_RANKING_DEFAULTS = Object.freeze({
  storyRecencyHalfLifeHours: 18,
  storyItemRecencyHalfLifeHours: 16,
  velocityWindowHours: 12,
  popularityCap: 8,
  diversityCap: 6,
  velocityCap: 4,
  sourceRankDefault: 0.58,
  sourceRankTopSourceLimit: 3
});
