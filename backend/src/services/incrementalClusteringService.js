import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  findRecentCandidateArticles,
  markNormalizedItemClusteringFailed,
  markNormalizedItemClusteringResult,
  updateNormalizedItemEmbedding
} from '../repositories/normalizedItemRepository.js';
import { attachArticleToStory, createStoryFromArticle } from '../repositories/storyRepository.js';
import { buildArticleEmbedding, cosineSimilarity, generateEmbedding } from './embeddingService.js';

const MAX_SUPPORTING_ARTICLES_CAP = 5;
const RECENCY_WINDOW_HOURS = 24;

const toDate = (value) => (value ? new Date(value) : new Date());

const scoreStoryCandidate = ({ bestSimilarity, supportCount, recencyHours }) => {
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

export const clusterArticleIncrementally = async (article) => {
  if (article.clusteringStatus === 'clustered') {
    return { skipped: true, reason: 'already_clustered' };
  }

  try {
    let embedding = article.embedding;

    if (!Array.isArray(embedding) || !embedding.length) {
      const embeddingText = buildArticleEmbedding(article);
      logger.info('Generating embedding for normalized article', {
        normalizedItemId: String(article._id),
        embeddingModel: env.ZENADAM_EMBEDDING_MODEL
      });
      embedding = await generateEmbedding(embeddingText);
      await updateNormalizedItemEmbedding(article._id, {
        embedding,
        embeddingModel: env.ZENADAM_EMBEDDING_MODEL,
        embeddingCreatedAt: new Date()
      });
    }

    const candidates = await findRecentCandidateArticles(article, {
      candidateWindowHours: env.CANDIDATE_WINDOW_HOURS,
      maxCandidateArticles: env.MAX_CANDIDATE_ARTICLES
    });

    logger.info('Retrieved clustering candidates', {
      normalizedItemId: String(article._id),
      candidateCount: candidates.length,
      candidateWindowHours: env.CANDIDATE_WINDOW_HOURS
    });

    const nearestCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        similarity: cosineSimilarity(embedding, candidate.embedding)
      }))
      .filter((candidate) => candidate.similarity >= env.SIMILARITY_BORDERLINE_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, env.MAX_NEAREST_ARTICLES);

    logger.info('Calculated nearest article similarities', {
      normalizedItemId: String(article._id),
      nearestCount: nearestCandidates.length,
      topSimilarities: nearestCandidates.slice(0, 3).map((item) => Number(item.similarity.toFixed(4)))
    });

    const bestStory = evaluateStoryCandidates(article, nearestCandidates);

    if (bestStory && selectClusteringAction({ bestStoryScore: bestStory.score, strongThreshold: env.SIMILARITY_STRONG_THRESHOLD }) === 'attach') {
      const updatedStory = await attachArticleToStory({
        storyId: bestStory.storyId,
        article
      });

      await markNormalizedItemClusteringResult(article._id, {
        storyId: bestStory.storyId,
        clusteredAt: new Date(),
        clusteringStatus: 'clustered',
        clusteringScore: bestStory.score,
        clusteringMetadata: {
          bestSimilarity: bestStory.bestSimilarity,
          supportCount: bestStory.supportCount,
          recencyHours: bestStory.recencyHours
        }
      });

      logger.info('Attached article to existing story', {
        normalizedItemId: String(article._id),
        storyId: bestStory.storyId,
        score: bestStory.score
      });

      return { action: 'attached', storyId: bestStory.storyId, score: bestStory.score, story: updatedStory };
    }

    const story = await createStoryFromArticle(article);
    await markNormalizedItemClusteringResult(article._id, {
      storyId: story._id,
      clusteredAt: new Date(),
      clusteringStatus: 'clustered',
      clusteringScore: bestStory?.score ?? 0,
      clusteringMetadata: {
        reason: 'no_strong_story_match',
        bestCandidateScore: bestStory?.score ?? null
      }
    });

    logger.info('Created new story from article', {
      normalizedItemId: String(article._id),
      storyId: String(story._id)
    });

    return { action: 'created', storyId: String(story._id), score: bestStory?.score ?? 0, story };
  } catch (error) {
    await markNormalizedItemClusteringFailed(article._id, error.message);
    logger.error('Incremental clustering failed', {
      normalizedItemId: String(article._id),
      message: error.message
    });
    return { action: 'failed', error: error.message };
  }
};
