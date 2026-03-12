import { ObjectId } from 'mongodb';
import { STORY_STATUS } from '../models/Story.js';
import { findUnclusteredNormalizedItems, markNormalizedItemsClustered } from '../repositories/normalizedItemRepository.js';
import {
  findStoryForConsumerById,
  findStoryForInspectionById,
  listConsumerStoryArticles,
  listActiveStories,
  listStoriesForConsumer,
  listStoriesForInspection,
  upsertStoryByClusterKey
} from '../repositories/storyRepository.js';
import { ensureRuntimeInitialized } from './runtimeService.js';
import { clusterNormalizedItems } from '../clustering/storyClusterer.js';
import { env } from '../config/env.js';
import { clusterArticleIncrementally } from './incrementalClusteringService.js';

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const generateStoriesFromNormalizedItems = async ({ limit = 250 } = {}) => {
  await ensureRuntimeInitialized();

  const items = await findUnclusteredNormalizedItems(limit);
  if (!items.length) {
    return { scanned: 0, generated: 0, attached: 0, failed: 0 };
  }

  if (env.VECTOR_SEARCH_ENABLED && env.VECTOR_INDEX_SETTLE_MS > 0) {
    await wait(env.VECTOR_INDEX_SETTLE_MS);
  }

  let generated = 0;
  let attached = 0;
  let failed = 0;

  for (const item of items) {
    const result = await clusterArticleIncrementally(item);
    if (result.action === 'created') {
      generated += 1;
    } else if (result.action === 'attached') {
      attached += 1;
    } else if (result.action === 'failed') {
      failed += 1;
    }
  }

  return {
    scanned: items.length,
    generated,
    attached,
    failed
  };
};

// Legacy helper kept for compatibility with previous batch flow.
export const generateStoriesFromLegacyClusterKeys = async ({ limit = 250 } = {}) => {
  await ensureRuntimeInitialized();

  const items = await findUnclusteredNormalizedItems(limit);
  if (!items.length) {
    return { scanned: 0, generated: 0 };
  }

  const clusters = clusterNormalizedItems(items);
  let generated = 0;

  for (const cluster of clusters) {
    await upsertStoryByClusterKey({
      ...cluster,
      status: STORY_STATUS.ACTIVE
    });
    await markNormalizedItemsClustered(
      cluster.normalizedItemIds.map((id) => String(id)),
      cluster.clusterKey
    );
    generated += 1;
  }

  return {
    scanned: items.length,
    generated
  };
};

const toIso = (value) => (value?.toISOString?.() ? value.toISOString() : null);

export const mapConsumerStoryListItem = (story) => ({
  id: String(story._id),
  title: story.storyTitle ?? story.title,
  summary: story.storySummary ?? story.summary ?? null,
  sourceCount: story.sourceCount ?? 0,
  latestPublishedAt: toIso(story.latestPublishedAt),
  updatedAt: toIso(story.updatedAt),
  sourcePreview: (story.sourcePreview ?? []).map((item) => item.sourceName).filter(Boolean)
});

export const mapConsumerStoryArticle = (article) => ({
  id: String(article._id),
  storyId: article.storyId ? String(article.storyId) : null,
  title: article.title,
  summary: article.summary ?? null,
  snippet: article.snippet ?? null,
  sourceName: article.sourceName ?? null,
  publishedAt: toIso(article.publishedAt),
  canonicalUrl: article.canonicalUrl ?? null,
  targetLanguage: article.targetLanguage ?? null
});

export const mapConsumerStoryDetail = (story) => ({
  id: String(story._id),
  title: story.storyTitle ?? story.title,
  summary: story.storySummary ?? story.summary ?? null,
  sourceCount: story.sourceCount ?? 0,
  articleCount: story.articleCount ?? 0,
  latestPublishedAt: toIso(story.latestPublishedAt),
  updatedAt: toIso(story.updatedAt),
  articlePreviews: (story.articlePreviews ?? []).map(mapConsumerStoryArticle)
});

export const mapInspectionStoryListItem = (story) => ({
  id: String(story._id),
  title: story.storyTitle ?? story.title,
  summary: story.storySummary ?? story.summary ?? null,
  articleCount: story.articleCount ?? 0,
  latestArticleAt: toIso(story.latestArticleAt ?? story.updatedAt),
  createdAt: toIso(story.createdAt),
  previewArticles: (story.previewArticles ?? []).map((article) => ({
    title: article.title,
    source: article.source ?? null,
    publishedAt: toIso(article.publishedAt)
  }))
});

export const getFeedStories = async ({ limit = 25 } = {}) => {
  await ensureRuntimeInitialized();

  const stories = await listStoriesForConsumer({ limit });

  return stories.map((story) => ({
    ...mapConsumerStoryListItem(story),
    heroImageUrl: null
  }));
};

export const getConsumerStories = async ({ limit = 25 } = {}) => {
  await ensureRuntimeInitialized();

  const items = await listStoriesForConsumer({ limit });

  return {
    items: items.map(mapConsumerStoryListItem),
    pagination: {
      limit,
      count: items.length
    }
  };
};

export const getConsumerStoryById = async ({ id }) => {
  await ensureRuntimeInitialized();

  if (!ObjectId.isValid(id)) {
    const error = new Error('Invalid story id');
    error.code = 'INVALID_STORY_ID';
    error.statusCode = 400;
    throw error;
  }

  const story = await findStoryForConsumerById({ id });
  if (!story) {
    const error = new Error('Story not found');
    error.code = 'STORY_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return mapConsumerStoryDetail(story);
};

export const getConsumerStoryArticles = async ({ storyId }) => {
  await ensureRuntimeInitialized();

  if (!ObjectId.isValid(storyId)) {
    const error = new Error('Invalid story id');
    error.code = 'INVALID_STORY_ID';
    error.statusCode = 400;
    throw error;
  }

  const story = await findStoryForConsumerById({ id: storyId });
  if (!story) {
    const error = new Error('Story not found');
    error.code = 'STORY_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const articles = await listConsumerStoryArticles({ storyId });
  if (!articles.length) {
    const error = new Error('Story has no articles');
    error.code = 'STORY_NO_ARTICLES';
    error.statusCode = 404;
    throw error;
  }

  return {
    storyId,
    title: story.storyTitle ?? story.title,
    articleCount: articles.length,
    articles: articles.map(mapConsumerStoryArticle)
  };
};

export const getStoriesForInspection = async ({ page, limit, sort, hasSummary, minArticleCount }) => {
  await ensureRuntimeInitialized();

  const result = await listStoriesForInspection({
    page,
    limit,
    sort,
    hasSummary,
    minArticleCount
  });

  return {
    items: result.items.map(mapInspectionStoryListItem),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.total > 0 ? Math.ceil(result.total / result.limit) : 0,
      hasNextPage: result.page * result.limit < result.total,
      hasPrevPage: result.page > 1
    }
  };
};

export const mapInspectionStoryArticle = (article, includeDebug) => {
  const mapped = {
    id: String(article._id),
    source: article.sourceName ?? null,
    sourceType: article.sourceType ?? null,
    title: article.title,
    url: article.canonicalUrl ?? null,
    publishedAt: toIso(article.publishedAt),
    language: article.language ?? null,
    createdAt: toIso(article.createdAt)
  };

  if (includeDebug) {
    mapped.debug = {
      clusteringScore: article.clusteringScore ?? null,
      clusteringMetadata: article.clusteringMetadata ?? null
    };
  }

  return mapped;
};

export const getStoryForInspectionById = async ({ id, debug = false }) => {
  await ensureRuntimeInitialized();

  if (!ObjectId.isValid(id)) {
    const error = new Error('Invalid story id');
    error.code = 'INVALID_STORY_ID';
    error.statusCode = 400;
    throw error;
  }

  const story = await findStoryForInspectionById({ id });

  if (!story) {
    const error = new Error('Story not found');
    error.code = 'STORY_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const response = {
    id: String(story._id),
    title: story.storyTitle ?? story.title,
    summary: story.storySummary ?? story.summary ?? null,
    createdAt: toIso(story.createdAt),
    updatedAt: toIso(story.updatedAt),
    articleCount: story.articleCount ?? 0,
    articles: (story.articles ?? []).map((article) => mapInspectionStoryArticle(article, debug))
  };

  if (debug) {
    response.debug = {
      representativeArticleId: story.heroArticleId ? String(story.heroArticleId) : null
    };
  }

  return response;
};
