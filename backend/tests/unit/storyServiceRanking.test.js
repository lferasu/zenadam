import assert from 'node:assert/strict';
import test from 'node:test';

import { mapConsumerStoryArticle, mapConsumerStoryListItem } from '../../src/services/storyService.js';

test('mapConsumerStoryListItem includes persisted ranking metadata', () => {
  const item = mapConsumerStoryListItem({
    _id: 'story-1',
    storyTitle: 'Ranked story',
    storySummary: 'Story summary',
    heroImage: null,
    ranking: {
      storyScore: 0.8123,
      sortLatestAt: new Date('2026-03-13T11:00:00.000Z'),
      strategyVersion: 'story-ranking-v1',
      lastRankedAt: new Date('2026-03-13T11:05:00.000Z'),
      signals: {
        recencyScore: 0.91,
        sourceRankScore: 0.74,
        popularityScore: 0.66,
        diversityScore: 0.5,
        velocityScore: 0.8
      }
    },
    sourceCount: 3,
    latestPublishedAt: new Date('2026-03-13T11:00:00.000Z'),
    updatedAt: new Date('2026-03-13T11:05:00.000Z'),
    sourcePreview: [{ sourceName: 'BBC' }]
  });

  assert.deepEqual(item.ranking, {
    storyScore: 0.8123,
    sortLatestAt: '2026-03-13T11:00:00.000Z',
    strategyVersion: 'story-ranking-v1',
    lastRankedAt: '2026-03-13T11:05:00.000Z',
    signals: {
      recencyScore: 0.91,
      sourceRankScore: 0.74,
      popularityScore: 0.66,
      diversityScore: 0.5,
      velocityScore: 0.8
    }
  });
});

test('mapConsumerStoryArticle includes story item ranking flags', () => {
  const article = mapConsumerStoryArticle({
    _id: 'article-1',
    storyId: 'story-1',
    title: 'Primary article',
    summary: 'Detailed summary',
    snippet: 'Snippet',
    image: null,
    sourceName: 'Reuters',
    publishedAt: new Date('2026-03-13T10:00:00.000Z'),
    canonicalUrl: 'https://example.com/a1',
    targetLanguage: 'am',
    storyItemRanking: {
      storyItemScore: 0.9032,
      isPrimary: true
    }
  });

  assert.equal(article.storyItemScore, 0.9032);
  assert.equal(article.isPrimary, true);
});
