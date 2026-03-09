import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  findNearestCandidateArticlesByVector,
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

const toFiniteSimilarity = (value) => {
  const similarity = Number(value);
  return Number.isFinite(similarity) ? similarity : 0;
};

export const createIncrementalClusteringRunner = (overrides = {}) => {
  const resolvedEnv = overrides.env ?? env;
  const resolvedDeps = {
    findNearestCandidateArticlesByVector: overrides.findNearestCandidateArticlesByVector ?? findNearestCandidateArticlesByVector,
    findRecentCandidateArticles: overrides.findRecentCandidateArticles ?? findRecentCandidateArticles,
    markNormalizedItemClusteringFailed: overrides.markNormalizedItemClusteringFailed ?? markNormalizedItemClusteringFailed,
    markNormalizedItemClusteringResult: overrides.markNormalizedItemClusteringResult ?? markNormalizedItemClusteringResult,
    updateNormalizedItemEmbedding: overrides.updateNormalizedItemEmbedding ?? updateNormalizedItemEmbedding,
    attachArticleToStory: overrides.attachArticleToStory ?? attachArticleToStory,
    createStoryFromArticle: overrides.createStoryFromArticle ?? createStoryFromArticle,
    buildArticleEmbedding: overrides.buildArticleEmbedding ?? buildArticleEmbedding,
    cosineSimilarity: overrides.cosineSimilarity ?? cosineSimilarity,
    generateEmbedding: overrides.generateEmbedding ?? generateEmbedding
  };

  const getFallbackNearestCandidates = async (article, embedding) => {
    const candidates = await resolvedDeps.findRecentCandidateArticles(article, {
      candidateWindowHours: resolvedEnv.CANDIDATE_WINDOW_HOURS,
      maxCandidateArticles: resolvedEnv.MAX_CANDIDATE_ARTICLES
    });

    const nearestCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        similarity: resolvedDeps.cosineSimilarity(embedding, candidate.embedding)
      }))
      .filter((candidate) => candidate.similarity >= resolvedEnv.SIMILARITY_BORDERLINE_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, resolvedEnv.MAX_NEAREST_ARTICLES);

    return { candidates, nearestCandidates };
  };

  const getVectorNearestCandidates = async (article, embedding) => {
    return resolvedDeps.findNearestCandidateArticlesByVector({
      articleId: article._id,
      embedding,
      publishedAt: article.publishedAt,
      candidateWindowHours: resolvedEnv.CANDIDATE_WINDOW_HOURS,
      limit: resolvedEnv.MAX_NEAREST_ARTICLES,
      numCandidates: resolvedEnv.VECTOR_NUM_CANDIDATES,
      indexName: resolvedEnv.VECTOR_SEARCH_INDEX_NAME
    });
  };

  return async (article) => {
    if (article.clusteringStatus === 'clustered') {
      return { skipped: true, reason: 'already_clustered' };
    }

    try {
      let embedding = article.embedding;

      if (!Array.isArray(embedding) || !embedding.length) {
        const embeddingText = resolvedDeps.buildArticleEmbedding(article);
        logger.info('Generating embedding for normalized article', {
          normalizedItemId: String(article._id),
          embeddingModel: resolvedEnv.ZENADAM_EMBEDDING_MODEL
        });
        embedding = await resolvedDeps.generateEmbedding(embeddingText);
        await resolvedDeps.updateNormalizedItemEmbedding(article._id, {
          embedding,
          embeddingModel: resolvedEnv.ZENADAM_EMBEDDING_MODEL,
          embeddingCreatedAt: new Date()
        });
      }

      let nearestCandidates = [];
      let lookupMethod = 'vector_search';

      if (resolvedEnv.VECTOR_SEARCH_ENABLED) {
        try {
          logger.info('Executing vector search for incremental clustering', {
            normalizedItemId: String(article._id),
            vectorIndexName: resolvedEnv.VECTOR_SEARCH_INDEX_NAME,
            vectorNumCandidates: resolvedEnv.VECTOR_NUM_CANDIDATES,
            nearestLimit: resolvedEnv.MAX_NEAREST_ARTICLES,
            candidateWindowHours: resolvedEnv.CANDIDATE_WINDOW_HOURS
          });

          const vectorCandidates = await getVectorNearestCandidates(article, embedding);
          nearestCandidates = vectorCandidates
            .map((candidate) => ({ ...candidate, similarity: toFiniteSimilarity(candidate.similarity) }))
            .filter((candidate) => candidate.similarity >= resolvedEnv.SIMILARITY_BORDERLINE_THRESHOLD)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, resolvedEnv.MAX_NEAREST_ARTICLES);

          logger.info('Vector search candidate retrieval completed', {
            normalizedItemId: String(article._id),
            candidateCount: vectorCandidates.length,
            nearestCount: nearestCandidates.length,
            topSimilarities: nearestCandidates.slice(0, 3).map((item) => Number(item.similarity.toFixed(4)))
          });
        } catch (error) {
          lookupMethod = 'recent_scan_fallback';
          logger.warn('Vector search unavailable, falling back to recent-scan cosine flow', {
            normalizedItemId: String(article._id),
            message: error.message
          });
        }
      } else {
        lookupMethod = 'recent_scan_fallback';
        logger.info('Vector search disabled via env; using fallback cosine scan', {
          normalizedItemId: String(article._id)
        });
      }

      if (lookupMethod === 'recent_scan_fallback') {
        const { candidates, nearestCandidates: fallbackNearest } = await getFallbackNearestCandidates(article, embedding);
        nearestCandidates = fallbackNearest;

        logger.info('Fallback candidate retrieval completed', {
          normalizedItemId: String(article._id),
          candidateCount: candidates.length,
          nearestCount: nearestCandidates.length,
          topSimilarities: nearestCandidates.slice(0, 3).map((item) => Number(item.similarity.toFixed(4)))
        });
      }

      const bestStory = evaluateStoryCandidates(article, nearestCandidates);

      if (bestStory && selectClusteringAction({ bestStoryScore: bestStory.score, strongThreshold: resolvedEnv.SIMILARITY_STRONG_THRESHOLD }) === 'attach') {
        const updatedStory = await resolvedDeps.attachArticleToStory({
          storyId: bestStory.storyId,
          article
        });

        await resolvedDeps.markNormalizedItemClusteringResult(article._id, {
          storyId: bestStory.storyId,
          clusteredAt: new Date(),
          clusteringStatus: 'clustered',
          clusteringScore: bestStory.score,
          clusteringMetadata: {
            lookupMethod,
            bestSimilarity: bestStory.bestSimilarity,
            supportCount: bestStory.supportCount,
            recencyHours: bestStory.recencyHours
          }
        });

        logger.info('Attached article to existing story', {
          normalizedItemId: String(article._id),
          storyId: bestStory.storyId,
          score: bestStory.score,
          lookupMethod
        });

        return { action: 'attached', storyId: bestStory.storyId, score: bestStory.score, story: updatedStory };
      }

      const story = await resolvedDeps.createStoryFromArticle(article);
      await resolvedDeps.markNormalizedItemClusteringResult(article._id, {
        storyId: story._id,
        clusteredAt: new Date(),
        clusteringStatus: 'clustered',
        clusteringScore: bestStory?.score ?? 0,
        clusteringMetadata: {
          lookupMethod,
          reason: 'no_strong_story_match',
          bestCandidateScore: bestStory?.score ?? null
        }
      });

      logger.info('Created new story from article', {
        normalizedItemId: String(article._id),
        storyId: String(story._id),
        lookupMethod
      });

      return { action: 'created', storyId: String(story._id), score: bestStory?.score ?? 0, story };
    } catch (error) {
      await resolvedDeps.markNormalizedItemClusteringFailed(article._id, error.message);
      logger.error('Incremental clustering failed', {
        normalizedItemId: String(article._id),
        message: error.message
      });
      return { action: 'failed', error: error.message };
    }
  };
};

export const clusterArticleIncrementally = createIncrementalClusteringRunner();
