import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

import {
  createIncrementalClusteringRunner,
  evaluateStoryCandidates,
  selectClusteringAction
} from '../../src/services/incrementalClusteringService.js';
import { buildNearestVectorPipeline } from '../../src/repositories/normalizedItemRepository.js';

test('evaluateStoryCandidates prefers stronger same-story support', () => {
  const article = { publishedAt: '2026-01-10T12:00:00.000Z' };
  const candidates = [
    { storyId: 'story-a', similarity: 0.9, publishedAt: '2026-01-10T11:00:00.000Z' },
    { storyId: 'story-a', similarity: 0.88, publishedAt: '2026-01-10T10:00:00.000Z' },
    { storyId: 'story-b', similarity: 0.91, publishedAt: '2026-01-08T11:00:00.000Z' }
  ];

  const best = evaluateStoryCandidates(article, candidates);
  assert.equal(best.storyId, 'story-a');
  assert.ok(best.score > 0.8);
});

test('selectClusteringAction chooses attach when score passes threshold', () => {
  const action = selectClusteringAction({ bestStoryScore: 0.9, strongThreshold: 0.88 });
  assert.equal(action, 'attach');
});

test('selectClusteringAction chooses create when score below threshold', () => {
  const action = selectClusteringAction({ bestStoryScore: 0.8, strongThreshold: 0.88 });
  assert.equal(action, 'create');
});

test('buildNearestVectorPipeline includes vector stage filter and projection', () => {
  const articleId = new ObjectId();
  const publishedAt = new Date('2026-01-10T12:00:00.000Z');

  const pipeline = buildNearestVectorPipeline({
    articleId,
    embedding: [0.1, 0.2],
    publishedAt,
    candidateWindowHours: 72,
    limit: 10,
    numCandidates: 100,
    indexName: 'normalized_item_embedding_index'
  });

  assert.equal(pipeline[0].$vectorSearch.path, 'embedding');
  assert.equal(pipeline[0].$vectorSearch.filter._id.$ne.toString(), articleId.toString());
  assert.equal(pipeline[0].$vectorSearch.filter.publishedAt.$lte.toISOString(), publishedAt.toISOString());
  assert.equal(pipeline[1].$project.similarity.$meta, 'vectorSearchScore');
});

test('clusterArticleIncrementally attaches to story using vector candidates', async () => {
  const articleId = new ObjectId();
  const storyId = new ObjectId();
  const sourceItemId = new ObjectId();
  const sourceId = new ObjectId();

  const calls = { attach: 0, create: 0, fallback: 0 };

  const cluster = createIncrementalClusteringRunner({
    env: {
      ZENADAM_EMBEDDING_MODEL: 'text-embedding-3-large',
      VECTOR_SEARCH_ENABLED: true,
      VECTOR_SEARCH_INDEX_NAME: 'normalized_item_embedding_index',
      VECTOR_NUM_CANDIDATES: 100,
      CANDIDATE_WINDOW_HOURS: 72,
      MAX_CANDIDATE_ARTICLES: 200,
      MAX_NEAREST_ARTICLES: 10,
      SIMILARITY_STRONG_THRESHOLD: 0.88,
      SIMILARITY_BORDERLINE_THRESHOLD: 0.82
    },
    findNearestCandidateArticlesByVector: async () => [
      { storyId, similarity: 0.93, publishedAt: '2026-01-10T11:00:00.000Z' },
      { storyId, similarity: 0.9, publishedAt: '2026-01-10T10:45:00.000Z' },
      { storyId, similarity: 0.89, publishedAt: '2026-01-10T10:30:00.000Z' },
      { storyId, similarity: 0.88, publishedAt: '2026-01-10T10:15:00.000Z' },
      { storyId, similarity: 0.87, publishedAt: '2026-01-10T10:00:00.000Z' }
    ],
    findRecentCandidateArticles: async () => {
      calls.fallback += 1;
      return [];
    },
    markNormalizedItemClusteringFailed: async () => ({}),
    markNormalizedItemClusteringResult: async () => ({}),
    updateNormalizedItemEmbedding: async () => ({}),
    attachArticleToStory: async () => {
      calls.attach += 1;
      return { _id: storyId };
    },
    createStoryFromArticle: async () => {
      calls.create += 1;
      return { _id: new ObjectId() };
    },
    buildArticleEmbedding: () => 'title snippet',
    cosineSimilarity: () => 0,
    generateEmbedding: async () => [0.2, 0.3]
  });

  const result = await cluster({
    _id: articleId,
    sourceItemId,
    sourceId,
    title: 'title',
    snippet: 'snippet',
    publishedAt: '2026-01-10T12:00:00.000Z'
  });

  assert.equal(result.action, 'attached');
  assert.equal(calls.attach, 1);
  assert.equal(calls.create, 0);
  assert.equal(calls.fallback, 0);
});

test('clusterArticleIncrementally falls back to scan when vector lookup fails', async () => {
  const articleId = new ObjectId();
  const sourceItemId = new ObjectId();
  const sourceId = new ObjectId();

  const calls = { fallback: 0, created: 0 };

  const cluster = createIncrementalClusteringRunner({
    env: {
      ZENADAM_EMBEDDING_MODEL: 'text-embedding-3-large',
      VECTOR_SEARCH_ENABLED: true,
      VECTOR_SEARCH_INDEX_NAME: 'normalized_item_embedding_index',
      VECTOR_NUM_CANDIDATES: 100,
      CANDIDATE_WINDOW_HOURS: 72,
      MAX_CANDIDATE_ARTICLES: 200,
      MAX_NEAREST_ARTICLES: 10,
      SIMILARITY_STRONG_THRESHOLD: 0.88,
      SIMILARITY_BORDERLINE_THRESHOLD: 0.82
    },
    findNearestCandidateArticlesByVector: async () => {
      throw new Error('vector offline');
    },
    findRecentCandidateArticles: async () => {
      calls.fallback += 1;
      return [];
    },
    markNormalizedItemClusteringFailed: async () => ({}),
    markNormalizedItemClusteringResult: async () => ({}),
    updateNormalizedItemEmbedding: async () => ({}),
    attachArticleToStory: async () => null,
    createStoryFromArticle: async () => {
      calls.created += 1;
      return { _id: new ObjectId() };
    },
    buildArticleEmbedding: () => 'title snippet',
    cosineSimilarity: () => 0.7,
    generateEmbedding: async () => [0.2, 0.3]
  });

  const result = await cluster({
    _id: articleId,
    sourceItemId,
    sourceId,
    title: 'title',
    snippet: 'snippet',
    publishedAt: '2026-01-10T12:00:00.000Z'
  });

  assert.equal(result.action, 'created');
  assert.equal(calls.fallback, 1);
  assert.equal(calls.created, 1);
});
