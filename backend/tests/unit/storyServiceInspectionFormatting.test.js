import assert from 'node:assert/strict';
import test from 'node:test';

import { mapInspectionStoryArticle, mapInspectionStoryListItem } from '../../src/services/storyService.js';

test('mapInspectionStoryListItem builds story inspection payload', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const latest = new Date('2026-01-02T10:00:00.000Z');

  const item = mapInspectionStoryListItem({
    _id: 'story-1',
    title: 'Representative headline',
    summary: 'Story summary',
    heroImage: {
      url: 'https://example.com/story-hero.jpg',
      sourceItemId: 'article-1',
      selectionReason: 'best_resolution'
    },
    ranking: {
      storyScore: 0.81,
      sortLatestAt: new Date('2026-01-02T10:00:00.000Z'),
      strategyVersion: 'story-ranking-v1',
      lastRankedAt: new Date('2026-01-02T10:05:00.000Z'),
      signals: {
        recencyScore: 0.9,
        sourceRankScore: 0.7,
        popularityScore: 0.5,
        diversityScore: 0.4,
        velocityScore: 0.8
      }
    },
    articleCount: 4,
    latestArticleAt: latest,
    createdAt,
    previewArticles: [
      {
        title: 'Article one',
        image: {
          url: 'https://example.com/article-1.jpg',
          source: 'rss_media_content',
          status: 'found'
        },
        source: 'BBC',
        publishedAt: new Date('2026-01-02T09:30:00.000Z')
      }
    ]
  });

  assert.deepEqual(item, {
    id: 'story-1',
    title: 'Representative headline',
    summary: 'Story summary',
    heroImage: {
      url: 'https://example.com/story-hero.jpg',
      sourceItemId: 'article-1',
      selectionReason: 'best_resolution'
    },
    ranking: {
      storyScore: 0.81,
      sortLatestAt: '2026-01-02T10:00:00.000Z',
      strategyVersion: 'story-ranking-v1',
      lastRankedAt: '2026-01-02T10:05:00.000Z',
      signals: {
        recencyScore: 0.9,
        sourceRankScore: 0.7,
        popularityScore: 0.5,
        diversityScore: 0.4,
        velocityScore: 0.8
      }
    },
    articleCount: 4,
    latestArticleAt: '2026-01-02T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    previewArticles: [
      {
        title: 'Article one',
        image: {
          url: 'https://example.com/article-1.jpg',
          source: 'rss_media_content',
          status: 'found'
        },
        source: 'BBC',
        publishedAt: '2026-01-02T09:30:00.000Z'
      }
    ]
  });
});

test('mapInspectionStoryArticle includes debug block only when enabled', () => {
  const article = {
    _id: 'article-1',
    sourceName: 'Reuters',
    sourceType: 'rss',
    title: 'Clustered article',
    image: {
      url: 'https://example.com/article-1.jpg',
      source: 'rss_media_content',
      status: 'found'
    },
    canonicalUrl: 'https://example.com/a1',
    publishedAt: new Date('2026-02-01T11:00:00.000Z'),
    language: 'en',
    createdAt: new Date('2026-02-01T11:10:00.000Z'),
    clusteringScore: 0.81,
    clusteringMetadata: { lookupMethod: 'vector' }
  };

  const withoutDebug = mapInspectionStoryArticle(article, false);
  assert.equal(withoutDebug.debug, undefined);
  assert.equal(withoutDebug.image.url, 'https://example.com/article-1.jpg');

  const withDebug = mapInspectionStoryArticle(article, true);
  assert.deepEqual(withDebug.debug, {
    clusteringScore: 0.81,
    clusteringMetadata: { lookupMethod: 'vector' }
  });
});
