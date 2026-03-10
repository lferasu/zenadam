import { createCandidateRetrieval } from '../clustering/candidateRetrieval.js';
import { evaluateStoryCandidates, selectClusteringAction } from '../clustering/scoringPolicy.js';
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
import { refreshStorySummary } from './storyEnrichmentService.js';

export { evaluateStoryCandidates, selectClusteringAction };

const ensureArticleEmbedding = async ({ article, deps, envConfig }) => {
  let embedding = article.embedding;

  if (Array.isArray(embedding) && embedding.length) {
    return embedding;
  }

  const embeddingText = deps.buildArticleEmbedding(article);
  logger.info('Generating embedding for normalized article', {
    normalizedItemId: String(article._id),
    embeddingModel: envConfig.ZENADAM_EMBEDDING_MODEL
  });

  embedding = await deps.generateEmbedding(embeddingText);
  await deps.updateNormalizedItemEmbedding(article._id, {
    embedding,
    embeddingModel: envConfig.ZENADAM_EMBEDDING_MODEL,
    embeddingCreatedAt: new Date()
  });

  return embedding;
};

const attachToExistingStory = async ({ article, bestStory, lookupMethod, deps }) => {
  const updatedStory = await deps.attachArticleToStory({
    storyId: bestStory.storyId,
    article
  });

  if (updatedStory?._id) {
    await deps.refreshStorySummary({ storyId: updatedStory._id });
  }

  await deps.markNormalizedItemClusteringResult(article._id, {
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
};

const createNewStory = async ({ article, bestStory, lookupMethod, deps }) => {
  const story = await deps.createStoryFromArticle(article);

  if (story?._id) {
    await deps.refreshStorySummary({ storyId: story._id });
  }

  await deps.markNormalizedItemClusteringResult(article._id, {
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
};

export const createIncrementalClusteringRunner = (overrides = {}) => {
  const resolvedEnv = overrides.env ?? env;
  const deps = {
    findNearestCandidateArticlesByVector: overrides.findNearestCandidateArticlesByVector ?? findNearestCandidateArticlesByVector,
    findRecentCandidateArticles: overrides.findRecentCandidateArticles ?? findRecentCandidateArticles,
    markNormalizedItemClusteringFailed: overrides.markNormalizedItemClusteringFailed ?? markNormalizedItemClusteringFailed,
    markNormalizedItemClusteringResult: overrides.markNormalizedItemClusteringResult ?? markNormalizedItemClusteringResult,
    updateNormalizedItemEmbedding: overrides.updateNormalizedItemEmbedding ?? updateNormalizedItemEmbedding,
    attachArticleToStory: overrides.attachArticleToStory ?? attachArticleToStory,
    createStoryFromArticle: overrides.createStoryFromArticle ?? createStoryFromArticle,
    buildArticleEmbedding: overrides.buildArticleEmbedding ?? buildArticleEmbedding,
    cosineSimilarity: overrides.cosineSimilarity ?? cosineSimilarity,
    generateEmbedding: overrides.generateEmbedding ?? generateEmbedding,
    refreshStorySummary: overrides.refreshStorySummary ?? refreshStorySummary
  };

  const candidateRetrieval = createCandidateRetrieval({
    deps,
    env: resolvedEnv,
    logger
  });

  return async (article) => {
    if (article.clusteringStatus === 'clustered') {
      return { skipped: true, reason: 'already_clustered' };
    }

    try {
      const embedding = await ensureArticleEmbedding({
        article,
        deps,
        envConfig: resolvedEnv
      });

      const { lookupMethod, nearestCandidates } = await candidateRetrieval.retrieveNearestCandidates(article, embedding);
      const bestStory = evaluateStoryCandidates(article, nearestCandidates);

      if (bestStory && selectClusteringAction({ bestStoryScore: bestStory.score, strongThreshold: resolvedEnv.SIMILARITY_STRONG_THRESHOLD }) === 'attach') {
        return attachToExistingStory({
          article,
          bestStory,
          lookupMethod,
          deps
        });
      }

      return createNewStory({
        article,
        bestStory,
        lookupMethod,
        deps
      });
    } catch (error) {
      await deps.markNormalizedItemClusteringFailed(article._id, error.message);
      logger.error('Incremental clustering failed', {
        normalizedItemId: String(article._id),
        message: error.message
      });
      return { action: 'failed', error: error.message };
    }
  };
};

export const clusterArticleIncrementally = createIncrementalClusteringRunner();
