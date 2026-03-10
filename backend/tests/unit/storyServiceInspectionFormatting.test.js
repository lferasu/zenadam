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
    articleCount: 4,
    latestArticleAt: latest,
    createdAt,
    previewArticles: [
      {
        title: 'Article one',
        source: 'BBC',
        publishedAt: new Date('2026-01-02T09:30:00.000Z')
      }
    ]
  });

  assert.deepEqual(item, {
    id: 'story-1',
    title: 'Representative headline',
    summary: 'Story summary',
    articleCount: 4,
    latestArticleAt: '2026-01-02T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    previewArticles: [
      {
        title: 'Article one',
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
    canonicalUrl: 'https://example.com/a1',
    publishedAt: new Date('2026-02-01T11:00:00.000Z'),
    language: 'en',
    createdAt: new Date('2026-02-01T11:10:00.000Z'),
    clusteringScore: 0.81,
    clusteringMetadata: { lookupMethod: 'vector' }
  };

  const withoutDebug = mapInspectionStoryArticle(article, false);
  assert.equal(withoutDebug.debug, undefined);

  const withDebug = mapInspectionStoryArticle(article, true);
  assert.deepEqual(withDebug.debug, {
    clusteringScore: 0.81,
    clusteringMetadata: { lookupMethod: 'vector' }
  });
});
