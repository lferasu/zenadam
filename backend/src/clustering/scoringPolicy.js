const MAX_SUPPORTING_ARTICLES_CAP = 5;
const RECENCY_WINDOW_HOURS = 24;

const toDate = (value) => (value ? new Date(value) : new Date());

export const scoreStoryCandidate = ({ bestSimilarity, supportCount, recencyHours }) => {
  const supportingArticlesBoost = Math.min(supportCount / MAX_SUPPORTING_ARTICLES_CAP, 1);
  const recencyBoost = Math.max(0, 1 - recencyHours / RECENCY_WINDOW_HOURS);

  return {
    score: bestSimilarity * 0.75 + supportingArticlesBoost * 0.15 + recencyBoost * 0.1,
    supportingArticlesBoost,
    recencyBoost
  };
};

export const evaluateStoryCandidates = (article, nearestCandidates) => {
  const grouped = new Map();

  for (const candidate of nearestCandidates) {
    if (!candidate.storyId) {
      continue;
    }

    const key = String(candidate.storyId);
    const current = grouped.get(key) ?? {
      storyId: key,
      similarities: [],
      latestCandidatePublishedAt: null
    };
    current.similarities.push(candidate.similarity);

    if (!current.latestCandidatePublishedAt || new Date(candidate.publishedAt) > new Date(current.latestCandidatePublishedAt)) {
      current.latestCandidatePublishedAt = candidate.publishedAt;
    }

    grouped.set(key, current);
  }

  let best = null;

  for (const candidate of grouped.values()) {
    const bestSimilarity = Math.max(...candidate.similarities);
    const supportCount = candidate.similarities.length;
    const recencyHours =
      Math.abs(toDate(article.publishedAt).getTime() - toDate(candidate.latestCandidatePublishedAt).getTime()) /
      (1000 * 60 * 60);

    const scoreBreakdown = scoreStoryCandidate({ bestSimilarity, supportCount, recencyHours });
    const scored = {
      storyId: candidate.storyId,
      bestSimilarity,
      supportCount,
      recencyHours,
      ...scoreBreakdown
    };

    if (!best || scored.score > best.score) {
      best = scored;
    }
  }

  return best;
};

export const selectClusteringAction = ({ bestStoryScore, strongThreshold }) => {
  if (bestStoryScore >= strongThreshold) {
    return 'attach';
  }

  return 'create';
};
