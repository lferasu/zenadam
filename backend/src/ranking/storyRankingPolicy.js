import {
  STORY_RANKING_DEFAULTS,
  STORY_RANKING_STRATEGY_VERSION,
  STORY_RANKING_WEIGHTS
} from './constants.js';
import { getSourceRankScore } from './sourceRank.js';
import { cappedLinearScore, cappedLogScore, decayScore, roundScore, toDate } from './signalUtils.js';

const getNewestActivityDate = ({ story, items }) => {
  const itemCandidates = items.flatMap((item) => [item?.publishedAt, item?.updatedAt, item?.createdAt])
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  if (itemCandidates[0]) {
    return itemCandidates[0];
  }

  const storyCandidates = [story?.lastArticlePublishedAt, story?.lastSeenAt, story?.ranking?.sortLatestAt, story?.updatedAt]
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return storyCandidates[0] ?? null;
};

const buildUniqueSourceScores = (items = []) => {
  const scores = new Map();

  for (const item of items) {
    const sourceKey = item?.sourceId ? String(item.sourceId) : null;
    if (!sourceKey) {
      continue;
    }

    const score = getSourceRankScore(item.source ?? {});
    const current = scores.get(sourceKey) ?? 0;
    scores.set(sourceKey, Math.max(current, score));
  }

  return Array.from(scores.values()).sort((a, b) => b - a);
};

export const calculateStoryRanking = (story, items = [], context = {}) => {
  const now = toDate(context.now) ?? new Date();
  const weights = context.weights ?? STORY_RANKING_WEIGHTS;
  const newestActivityAt = getNewestActivityDate({ story, items }) ?? now;
  const uniqueSourceScores = buildUniqueSourceScores(items);
  const itemCount = items.length || story?.articleCount || (Array.isArray(story?.itemIds) ? story.itemIds.length : 0) || 0;
  const uniqueSourceCount =
    uniqueSourceScores.length || story?.sourceCount || (Array.isArray(story?.sourceIds) ? story.sourceIds.length : 0) || 0;
  const recentCutoff = new Date(now.getTime() - STORY_RANKING_DEFAULTS.velocityWindowHours * 60 * 60 * 1000);
  const recentItems = items.filter((item) => {
    const publishedAt = toDate(item?.publishedAt) ?? toDate(item?.createdAt) ?? toDate(item?.updatedAt);
    return publishedAt && publishedAt >= recentCutoff;
  }).length;

  const recencyScore = roundScore(
    decayScore({
      valueDate: newestActivityAt,
      now,
      halfLifeHours: STORY_RANKING_DEFAULTS.storyRecencyHalfLifeHours
    })
  );
  const sourceRankScore = roundScore(
    uniqueSourceScores.length
      ? uniqueSourceScores
          .slice(0, STORY_RANKING_DEFAULTS.sourceRankTopSourceLimit)
          .reduce((sum, score) => sum + score, 0) /
          Math.min(uniqueSourceScores.length, STORY_RANKING_DEFAULTS.sourceRankTopSourceLimit)
      : getSourceRankScore({})
  );
  const popularityScore = roundScore(
    cappedLogScore({
      value: itemCount,
      cap: STORY_RANKING_DEFAULTS.popularityCap
    })
  );
  const diversityScore = roundScore(
    cappedLinearScore({
      value: uniqueSourceCount,
      cap: STORY_RANKING_DEFAULTS.diversityCap
    })
  );
  const velocityScore = roundScore(
    cappedLogScore({
      value: recentItems,
      cap: STORY_RANKING_DEFAULTS.velocityCap
    })
  );

  const storyScore = Number(
    (
      recencyScore * weights.recencyScore +
      sourceRankScore * weights.sourceRankScore +
      popularityScore * weights.popularityScore +
      diversityScore * weights.diversityScore +
      velocityScore * weights.velocityScore
    ).toFixed(6)
  );

  return {
    storyScore,
    sortLatestAt: newestActivityAt,
    signals: {
      recencyScore,
      sourceRankScore,
      popularityScore,
      diversityScore,
      velocityScore
    },
    strategyVersion: STORY_RANKING_STRATEGY_VERSION,
    lastRankedAt: now
  };
};
