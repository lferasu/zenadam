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
  const article = {
    publishedAt: '2026-01-10T12:00:00.000Z',
    topicFingerprint: {
      keywords: ['ethiopia', 'conflict'],
      phrases: ['ethiopia conflict'],
      geographies: ['ethiopia'],
      entities: ['ethiopian government'],
      persons: ['Abiy Ahmed'],
      locations: ['Addis Ababa', 'Ethiopia']
    }
  };
  const candidates = [
    {
      storyId: 'story-a',
      similarity: 0.9,
      publishedAt: '2026-01-10T11:00:00.000Z',
      topicFingerprint: {
        keywords: ['ethiopia', 'conflict'],
        phrases: ['ethiopia conflict'],
        geographies: ['ethiopia'],
        entities: ['ethiopian government'],
        persons: ['Abiy Ahmed'],
        locations: ['Addis Ababa', 'Ethiopia']
      }
    },
    {
      storyId: 'story-a',
      similarity: 0.88,
      publishedAt: '2026-01-10T10:00:00.000Z',
      topicFingerprint: {
        keywords: ['ethiopia', 'security'],
        phrases: ['ethiopia security'],
        geographies: ['ethiopia'],
        entities: ['ethiopian government'],
        persons: ['Abiy Ahmed'],
        locations: ['Addis Ababa', 'Ethiopia']
      }
    },
    {
      storyId: 'story-b',
      similarity: 0.91,
      publishedAt: '2026-01-08T11:00:00.000Z',
      topicFingerprint: {
        keywords: ['iran', 'strike'],
        phrases: ['iran strike'],
        geographies: ['iran'],
        entities: ['iranian government'],
        persons: ['Other Leader'],
        locations: ['Tehran', 'Iran']
      }
    }
  ];

  const best = evaluateStoryCandidates(article, candidates);
  assert.equal(best.storyId, 'story-a');
  assert.ok(best.score > 0.6);
});

test('evaluateStoryCandidates gives strong preference to same person and location overlap', () => {
  const article = {
    publishedAt: '2026-01-10T12:00:00.000Z',
    topicFingerprint: {
      keywords: ['development', 'visit'],
      phrases: ['city development'],
      geographies: ['Dire Dawa'],
      entities: ['Prime Minister Abiy Ahmed', 'Dire Dawa'],
      persons: ['Abiy Ahmed'],
      locations: ['Dire Dawa', 'Ethiopia']
    }
  };

  const candidates = [
    {
      storyId: 'story-actor-place',
      similarity: 0.72,
      publishedAt: '2026-01-10T11:00:00.000Z',
      topicFingerprint: {
        keywords: ['urban', 'projects'],
        phrases: ['city projects'],
        geographies: ['Dire Dawa'],
        entities: ['Prime Minister Abiy Ahmed', 'Dire Dawa'],
        persons: ['Abiy Ahmed'],
        locations: ['Dire Dawa', 'Ethiopia']
      }
    },
    {
      storyId: 'story-semantic-only',
      similarity: 0.82,
      publishedAt: '2026-01-10T11:30:00.000Z',
      topicFingerprint: {
        keywords: ['development', 'visit'],
        phrases: ['city development'],
        geographies: ['Harar'],
        entities: ['Regional Officials'],
        persons: ['Regional Officials'],
        locations: ['Harar', 'Ethiopia']
      }
    }
  ];

  const best = evaluateStoryCandidates(article, candidates);
  assert.equal(best.storyId, 'story-actor-place');
  assert.ok(best.personOverlap > 0);
  assert.ok(best.locationOverlap > 0);
  assert.ok(best.strongPersonLocationBonus > 0);
});

test('evaluateStoryCandidates supports broader story-arc clustering beyond exact event match', () => {
  const article = {
    publishedAt: '2026-01-10T12:00:00.000Z',
    topicFingerprint: {
      keywords: ['turkey', 'ethiopia', 'diplomacy', 'horn'],
      phrases: ['horn diplomacy', 'regional tensions'],
      geographies: ['ethiopia'],
      entities: ['Recep Tayyip Erdogan', 'Turkey', 'Ethiopia'],
      persons: ['Recep Tayyip Erdogan'],
      locations: ['Ethiopia', 'Turkey', 'Horn of Africa']
    }
  };

  const candidates = [
    {
      storyId: 'story-broad-arc',
      similarity: 0.84,
      publishedAt: '2026-01-10T10:00:00.000Z',
      topicFingerprint: {
        keywords: ['turkey', 'ethiopia', 'mediation', 'regional'],
        phrases: ['regional mediation', 'horn diplomacy'],
        geographies: ['ethiopia'],
        entities: ['Turkey', 'Ethiopia', 'Horn of Africa'],
        persons: [],
        locations: ['Ethiopia', 'Turkey', 'Horn of Africa']
      }
    },
    {
      storyId: 'story-unrelated',
      similarity: 0.8,
      publishedAt: '2026-01-10T11:00:00.000Z',
      topicFingerprint: {
        keywords: ['sports', 'league', 'final'],
        phrases: ['league final'],
        geographies: ['england'],
        entities: ['Arsenal'],
        persons: [],
        locations: ['England']
      }
    }
  ];

  const best = evaluateStoryCandidates(article, candidates);
  assert.equal(best.storyId, 'story-broad-arc');
  assert.ok(best.bestSimilarity >= 0.84);
  assert.ok(best.topicCoherence >= 0.12);
  assert.ok(best.score >= 0.72);
  assert.equal(selectClusteringAction({ bestStory: best, strongThreshold: 0.88 }), 'attach');
});

test('selectClusteringAction chooses attach when score passes threshold', () => {
  const action = selectClusteringAction({
    bestStory: {
      score: 0.9,
      topicCoherence: 0.5,
      keywordOverlap: 0.5,
      phraseOverlap: 0.5,
      entityOverlap: 0.5,
      geographyOverlap: 0.5,
      personOverlap: 1,
      locationOverlap: 1,
      geographyMismatchPenalty: 0
    },
    strongThreshold: 0.88
  });
  assert.equal(action, 'attach');
});

test('selectClusteringAction chooses create when score below threshold', () => {
  const action = selectClusteringAction({
    bestStory: {
      score: 0.8,
      topicCoherence: 0.5,
      keywordOverlap: 0.5,
      phraseOverlap: 0.5,
      entityOverlap: 0.5,
      geographyOverlap: 0.5,
      personOverlap: 1,
      locationOverlap: 1,
      geographyMismatchPenalty: 0
    },
    strongThreshold: 0.88
  });
  assert.equal(action, 'create');
});

test('selectClusteringAction chooses create when topic coherence is too weak', () => {
  const action = selectClusteringAction({
    bestStory: {
      score: 0.95,
      topicCoherence: 0.05,
      keywordOverlap: 0,
      phraseOverlap: 0,
      entityOverlap: 0,
      geographyOverlap: 0,
      personOverlap: 0,
      locationOverlap: 0,
      geographyMismatchPenalty: 0.2
    },
    strongThreshold: 0.88
  });
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
  assert.equal(Object.prototype.hasOwnProperty.call(pipeline[0].$vectorSearch.filter, '_id'), false);
  assert.equal(pipeline[0].$vectorSearch.filter.publishedAt.$lte.toISOString(), publishedAt.toISOString());
  assert.equal(pipeline[1].$project.similarity.$meta, 'vectorSearchScore');
});

test('clusterArticleIncrementally attaches to story using vector candidates', async () => {
  const articleId = new ObjectId();
  const storyId = new ObjectId();
  const sourceItemId = new ObjectId();
  const sourceId = new ObjectId();

  const calls = { attach: 0, create: 0, fallback: 0 };
  const order = [];

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
      {
        storyId,
        similarity: 0.93,
        publishedAt: '2026-01-10T11:00:00.000Z',
        topicFingerprint: {
          keywords: ['ethiopia', 'conflict'],
          phrases: ['ethiopia conflict'],
          geographies: ['ethiopia'],
          entities: ['ethiopian government'],
          persons: ['Abiy Ahmed'],
          locations: ['Addis Ababa', 'Ethiopia']
        }
      },
      {
        storyId,
        similarity: 0.9,
        publishedAt: '2026-01-10T10:45:00.000Z',
        topicFingerprint: {
          keywords: ['ethiopia', 'security'],
          phrases: ['ethiopia security'],
          geographies: ['ethiopia'],
          entities: ['ethiopian government'],
          persons: ['Abiy Ahmed'],
          locations: ['Addis Ababa', 'Ethiopia']
        }
      }
    ],
    findRecentCandidateArticles: async () => {
      calls.fallback += 1;
      return [];
    },
    markNormalizedItemClusteringFailed: async () => ({}),
    markNormalizedItemClusteringResult: async () => {
      order.push('mark');
      return {};
    },
    updateNormalizedItemEmbedding: async () => ({}),
    attachArticleToStory: async () => {
      calls.attach += 1;
      order.push('attach');
      return { _id: storyId };
    },
    createStoryFromArticle: async () => {
      calls.create += 1;
      return { _id: new ObjectId() };
    },
    buildArticleEmbedding: () => 'title detailed-summary',
    cosineSimilarity: () => 0,
    generateEmbedding: async () => [0.2, 0.3],
    refreshStorySummary: async () => {
      order.push('refresh');
      return { refreshed: true };
    },
    refreshStoryHeroImage: async () => {
      order.push('hero');
      return { url: 'https://example.com/hero.jpg' };
    },
    refreshStoryRanking: async () => {
      order.push('ranking');
      return { refreshed: true };
    }
  });

  const result = await cluster({
    _id: articleId,
    sourceItemId,
    sourceId,
    title: 'title',
    snippet: 'snippet',
    topicFingerprint: {
      keywords: ['ethiopia', 'conflict'],
      phrases: ['ethiopia conflict'],
      geographies: ['ethiopia'],
      entities: ['ethiopian government'],
      persons: ['Abiy Ahmed'],
      locations: ['Addis Ababa', 'Ethiopia']
    },
    publishedAt: '2026-01-10T12:00:00.000Z'
  });

  assert.equal(result.action, 'attached');
  assert.equal(calls.attach, 1);
  assert.equal(calls.create, 0);
  assert.equal(calls.fallback, 0);
  assert.deepEqual(order, ['attach', 'mark', 'refresh', 'hero', 'ranking']);
});

test('clusterArticleIncrementally falls back to scan when vector lookup fails', async () => {
  const articleId = new ObjectId();
  const sourceItemId = new ObjectId();
  const sourceId = new ObjectId();

  const calls = { fallback: 0, created: 0 };
  const order = [];

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
    markNormalizedItemClusteringResult: async () => {
      order.push('mark');
      return {};
    },
    updateNormalizedItemEmbedding: async () => ({}),
    attachArticleToStory: async () => null,
    createStoryFromArticle: async () => {
      calls.created += 1;
      order.push('create');
      return { _id: new ObjectId() };
    },
    buildArticleEmbedding: () => 'title detailed-summary',
    cosineSimilarity: () => 0.7,
    generateEmbedding: async () => [0.2, 0.3],
    refreshStorySummary: async () => {
      order.push('refresh');
      return { refreshed: true };
    },
    refreshStoryHeroImage: async () => {
      order.push('hero');
      return { url: 'https://example.com/hero.jpg' };
    },
    refreshStoryRanking: async () => {
      order.push('ranking');
      return { refreshed: true };
    }
  });

  const result = await cluster({
    _id: articleId,
    sourceItemId,
    sourceId,
    title: 'title',
    snippet: 'snippet',
    topicFingerprint: {
      keywords: ['ethiopia', 'conflict'],
      phrases: ['ethiopia conflict'],
      geographies: ['ethiopia'],
      entities: ['ethiopian government'],
      persons: ['Abiy Ahmed'],
      locations: ['Addis Ababa', 'Ethiopia']
    },
    publishedAt: '2026-01-10T12:00:00.000Z'
  });

  assert.equal(result.action, 'created');
  assert.equal(calls.fallback, 1);
  assert.equal(calls.created, 1);
  assert.deepEqual(order, ['create', 'mark', 'refresh', 'hero', 'ranking']);
});

test('clusterArticleIncrementally falls back to scan when vector lookup returns no candidates', async () => {
  const articleId = new ObjectId();
  const sourceItemId = new ObjectId();
  const sourceId = new ObjectId();

  const calls = { fallback: 0, attach: 0 };

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
      SIMILARITY_BORDERLINE_THRESHOLD: 0.7
    },
    findNearestCandidateArticlesByVector: async () => [],
    findRecentCandidateArticles: async () => {
      calls.fallback += 1;
      return [
        {
          storyId: new ObjectId(),
          publishedAt: '2026-01-10T11:00:00.000Z',
          embedding: [0.2, 0.3],
          topicFingerprint: {
            keywords: ['ethiopia', 'conflict'],
            phrases: ['ethiopia conflict'],
            geographies: ['ethiopia'],
            entities: ['ethiopian government'],
            persons: ['Abiy Ahmed'],
            locations: ['Addis Ababa', 'Ethiopia']
          }
        }
      ];
    },
    markNormalizedItemClusteringFailed: async () => ({}),
    markNormalizedItemClusteringResult: async () => ({}),
    updateNormalizedItemEmbedding: async () => ({}),
    attachArticleToStory: async () => {
      calls.attach += 1;
      return { _id: new ObjectId() };
    },
    createStoryFromArticle: async () => ({ _id: new ObjectId() }),
    buildArticleEmbedding: () => 'title detailed-summary',
    cosineSimilarity: () => 0.9,
    generateEmbedding: async () => [0.2, 0.3],
    refreshStorySummary: async () => ({ refreshed: true }),
    refreshStoryHeroImage: async () => ({ url: 'https://example.com/hero.jpg' }),
    refreshStoryRanking: async () => ({ refreshed: true })
  });

  const result = await cluster({
    _id: articleId,
    sourceItemId,
    sourceId,
    title: 'title',
    snippet: 'snippet',
    topicFingerprint: {
      keywords: ['ethiopia', 'conflict'],
      phrases: ['ethiopia conflict'],
      geographies: ['ethiopia'],
      entities: ['ethiopian government'],
      persons: ['Abiy Ahmed'],
      locations: ['Addis Ababa', 'Ethiopia']
    },
    publishedAt: '2026-01-10T12:00:00.000Z'
  });

  assert.equal(result.action, 'attached');
  assert.equal(calls.fallback, 1);
  assert.equal(calls.attach, 1);
});
