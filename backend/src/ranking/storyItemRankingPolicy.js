import { STORY_ITEM_RANKING_WEIGHTS, STORY_RANKING_DEFAULTS } from './constants.js';
import { getSourceRankScore } from './sourceRank.js';
import { clamp01, decayScore, roundScore, toDate } from './signalUtils.js';

const scoreCompleteness = (item) => {
  const summaryLength = Math.max(
    item?.normalizedDetailedSummary?.length ?? 0,
    item?.summary?.length ?? 0,
    item?.snippet?.length ?? 0
  );
  const contentLength = Math.max(item?.content?.length ?? 0, item?.contentOriginal?.length ?? 0);
  const titleLength = item?.title?.length ?? 0;

  const summaryScore = clamp01(summaryLength / 500);
  const contentScore = clamp01(contentLength / 2000);
  const titleScore = clamp01(titleLength / 120);

  return roundScore(summaryScore * 0.45 + contentScore * 0.4 + titleScore * 0.15);
};

const scoreCentrality = (item) => {
  const candidates = [
    item?.storyCentralityScore,
    item?.clusteringScore,
    item?.clusteringMetadata?.bestSimilarity,
    item?.clusteringMetadata?.topicCoherence
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return roundScore(numeric);
    }
  }

  return 0.6;
};

export const rankStoryItems = (items = [], story = null, context = {}) => {
  const now = toDate(context.now) ?? new Date();
  const weights = context.weights ?? STORY_ITEM_RANKING_WEIGHTS;

  const ranked = items.map((item) => {
    const sourceRankScore = roundScore(getSourceRankScore(item.source ?? {}));
    const recencyScore = roundScore(
      decayScore({
        valueDate: item?.publishedAt ?? item?.updatedAt ?? item?.createdAt ?? story?.updatedAt,
        now,
        halfLifeHours: STORY_RANKING_DEFAULTS.storyItemRecencyHalfLifeHours
      })
    );
    const centralityScore = roundScore(scoreCentrality(item));
    const completenessScore = roundScore(scoreCompleteness(item));
    const storyItemScore = Number(
      (
        sourceRankScore * weights.sourceRankScore +
        recencyScore * weights.recencyScore +
        centralityScore * weights.centralityScore +
        completenessScore * weights.completenessScore
      ).toFixed(6)
    );

    return {
      ...item,
      storyItemRanking: {
        storyItemScore,
        signals: {
          sourceRankScore,
          recencyScore,
          centralityScore,
          completenessScore
        }
      }
    };
  });

  ranked.sort((left, right) => {
    if (right.storyItemRanking.storyItemScore !== left.storyItemRanking.storyItemScore) {
      return right.storyItemRanking.storyItemScore - left.storyItemRanking.storyItemScore;
    }

    const rightPublishedAt = toDate(right.publishedAt ?? right.updatedAt ?? right.createdAt)?.getTime() ?? 0;
    const leftPublishedAt = toDate(left.publishedAt ?? left.updatedAt ?? left.createdAt)?.getTime() ?? 0;
    if (rightPublishedAt !== leftPublishedAt) {
      return rightPublishedAt - leftPublishedAt;
    }

    return String(right._id).localeCompare(String(left._id));
  });

  return ranked.map((item, index) => ({
    ...item,
    storyItemRanking: {
      ...item.storyItemRanking,
      isPrimary: index === 0
    }
  }));
};
