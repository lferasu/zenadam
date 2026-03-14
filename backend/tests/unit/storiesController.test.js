import assert from 'node:assert/strict';
import test from 'node:test';

import { createStoriesHandlers } from '../../src/controllers/stories.controller.js';

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

test('GET stories returns story list successfully', async () => {
  let receivedArgs = null;
  const handlers = createStoriesHandlers({
    getConsumerStories: async (args) => {
      receivedArgs = args;
      return ({
      items: [
        {
          id: 'story-1',
          title: 'Story title',
          summary: 'Story summary',
          heroImage: {
            url: 'https://example.com/story-hero.jpg',
            sourceItemId: 'article-1',
            selectionReason: 'best_resolution'
          },
          ranking: {
            storyScore: 0.82,
            sortLatestAt: '2026-01-10T12:00:00.000Z',
            strategyVersion: 'story-ranking-v1',
            lastRankedAt: '2026-01-10T12:05:00.000Z',
            signals: {
              recencyScore: 0.9,
              sourceRankScore: 0.7,
              popularityScore: 0.5,
              diversityScore: 0.4,
              velocityScore: 0.8
            }
          },
          sourceCount: 2,
          latestPublishedAt: '2026-01-10T12:00:00.000Z',
          updatedAt: '2026-01-10T12:10:00.000Z',
          sourcePreview: ['BBC']
        }
      ],
      pagination: { limit: 25, count: 1, sort: 'latest' }
    });
    }
  });

  const req = { query: { sort: 'latest' }, requestId: 'req-1' };
  const res = createResponse();
  await handlers.getStories(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(receivedArgs, { limit: 25, skip: 0, sort: 'latest' });
  assert.deepEqual(res.body, {
    data: [
      {
        id: 'story-1',
        title: 'Story title',
        summary: 'Story summary',
        heroImage: {
          url: 'https://example.com/story-hero.jpg',
          sourceItemId: 'article-1',
          selectionReason: 'best_resolution'
        },
        ranking: {
          storyScore: 0.82,
          sortLatestAt: '2026-01-10T12:00:00.000Z',
          strategyVersion: 'story-ranking-v1',
          lastRankedAt: '2026-01-10T12:05:00.000Z',
          signals: {
            recencyScore: 0.9,
            sourceRankScore: 0.7,
            popularityScore: 0.5,
            diversityScore: 0.4,
            velocityScore: 0.8
          }
        },
        sourceCount: 2,
        latestPublishedAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:10:00.000Z',
        sourcePreview: ['BBC']
      }
    ],
    meta: {
      requestId: 'req-1',
      pagination: { limit: 25, count: 1, sort: 'latest' }
    },
    error: null
  });
});

test('GET stories forwards search query when provided', async () => {
  let receivedArgs = null;
  const handlers = createStoriesHandlers({
    getConsumerStories: async (args) => {
      receivedArgs = args;
      return { items: [], pagination: { limit: 25, count: 0, sort: 'relevant', query: 'ethiopia' } };
    }
  });

  const req = { query: { q: '  ethiopia  ' }, requestId: 'req-search' };
  const res = createResponse();
  await handlers.getStories(req, res, (error) => {
    throw error;
  });

  assert.deepEqual(receivedArgs, { limit: 25, skip: 0, sort: undefined, query: 'ethiopia' });
  assert.equal(res.body.meta.pagination.query, 'ethiopia');
});

test('GET stories forwards skip for pagination', async () => {
  let receivedArgs = null;
  const handlers = createStoriesHandlers({
    getConsumerStories: async (args) => {
      receivedArgs = args;
      return { items: [], pagination: { limit: 12, skip: 12, count: 0, hasMore: false, sort: 'relevant' } };
    }
  });

  const req = { query: { limit: '12', skip: '12' }, requestId: 'req-skip' };
  const res = createResponse();
  await handlers.getStories(req, res, (error) => {
    throw error;
  });

  assert.deepEqual(receivedArgs, { limit: 12, skip: 12, sort: undefined });
  assert.equal(res.body.meta.pagination.skip, 12);
});

test('GET story by id returns one story', async () => {
  const handlers = createStoriesHandlers({
    getConsumerStoryById: async () => ({
      id: 'story-1',
      title: 'Story title',
      summary: 'Story summary',
      heroImage: {
        url: 'https://example.com/story-hero.jpg',
        sourceItemId: 'article-1',
        selectionReason: 'best_resolution'
      },
      ranking: {
        storyScore: 0.82,
        sortLatestAt: '2026-01-10T12:00:00.000Z',
        strategyVersion: 'story-ranking-v1',
        lastRankedAt: '2026-01-10T12:05:00.000Z',
        signals: {
          recencyScore: 0.9,
          sourceRankScore: 0.7,
          popularityScore: 0.5,
          diversityScore: 0.4,
          velocityScore: 0.8
        }
      },
      sourceCount: 2,
      articleCount: 3,
      latestPublishedAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:10:00.000Z',
      articlePreviews: []
    })
  });

  const req = { params: { storyId: 'story-1' }, requestId: 'req-2' };
  const res = createResponse();
  await handlers.getStoryById(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, 'story-1');
  assert.equal(res.body.data.articleCount, 3);
  assert.equal(res.body.error, null);
});

test('GET story articles returns normalized article values, not raw fields', async () => {
  const handlers = createStoriesHandlers({
    getConsumerStoryArticles: async () => ({
      storyId: 'story-1',
      title: 'Story title',
      articleCount: 1,
      articles: [
        {
          id: 'article-1',
          storyId: 'story-1',
          title: 'Normalized title',
          summary: 'Normalized detailed summary',
          snippet: 'Normalized snippet',
          image: {
            url: 'https://example.com/article-image.jpg',
            source: 'rss_media_content',
            status: 'found'
          },
          sourceName: 'BBC Amharic',
          publishedAt: '2026-01-10T12:00:00.000Z',
          canonicalUrl: 'https://example.com/a1',
          targetLanguage: 'am',
          storyItemScore: 0.91,
          isPrimary: true
        }
      ]
    })
  });

  const req = { params: { storyId: 'story-1' }, requestId: 'req-3' };
  const res = createResponse();
  await handlers.getStoryArticles(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.articles[0], {
    id: 'article-1',
    storyId: 'story-1',
    title: 'Normalized title',
    summary: 'Normalized detailed summary',
    snippet: 'Normalized snippet',
    image: {
      url: 'https://example.com/article-image.jpg',
      source: 'rss_media_content',
      status: 'found'
    },
    sourceName: 'BBC Amharic',
    publishedAt: '2026-01-10T12:00:00.000Z',
    canonicalUrl: 'https://example.com/a1',
    targetLanguage: 'am',
    storyItemScore: 0.91,
    isPrimary: true
  });
  assert.equal('rawTitle' in res.body.data.articles[0], false);
  assert.equal('rawText' in res.body.data.articles[0], false);
});
