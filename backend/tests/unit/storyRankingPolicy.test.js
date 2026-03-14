import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

import { rankStoryItems } from '../../src/ranking/storyItemRankingPolicy.js';
import { calculateStoryRanking } from '../../src/ranking/storyRankingPolicy.js';
import { normalizeStorySort, refreshStoryRanking } from '../../src/ranking/storyRankingService.js';

const now = new Date('2026-03-13T12:00:00.000Z');

const buildItem = ({
  sourceId = new ObjectId(),
  publishedAt,
  createdAt = publishedAt,
  source = { status: 'active', type: 'rss' },
  clusteringScore = 0.8,
  summary = 'summary',
  content = 'x'.repeat(1500),
  title = 'Article title'
} = {}) => ({
  _id: new ObjectId(),
  sourceId,
  publishedAt,
  createdAt,
  updatedAt: createdAt,
  source,
  clusteringScore,
  summary,
  normalizedDetailedSummary: summary,
  content,
  title
});

test('calculateStoryRanking rewards fresher and more diverse stories', () => {
  const freshDiverse = calculateStoryRanking(
    { updatedAt: now },
    [
      buildItem({ sourceId: new ObjectId(), publishedAt: new Date('2026-03-13T11:00:00.000Z') }),
      buildItem({ sourceId: new ObjectId(), publishedAt: new Date('2026-03-13T10:30:00.000Z') })
    ],
    { now }
  );

  const staleSingleSource = calculateStoryRanking(
    { updatedAt: now },
    [
      buildItem({
        sourceId: new ObjectId('65f0f2c5380d9be6c5940a11'),
        publishedAt: new Date('2026-03-10T06:00:00.000Z')
      }),
      buildItem({
        sourceId: new ObjectId('65f0f2c5380d9be6c5940a11'),
        publishedAt: new Date('2026-03-10T05:30:00.000Z')
      })
    ],
    { now }
  );

  assert.ok(freshDiverse.signals.recencyScore > staleSingleSource.signals.recencyScore);
  assert.ok(freshDiverse.signals.diversityScore > staleSingleSource.signals.diversityScore);
  assert.ok(freshDiverse.storyScore > staleSingleSource.storyScore);
});

test('calculateStoryRanking boosts velocity for stories gaining items now', () => {
  const slowStory = calculateStoryRanking(
    { updatedAt: now },
    [buildItem({ publishedAt: new Date('2026-03-12T05:00:00.000Z') })],
    { now }
  );

  const fastStory = calculateStoryRanking(
    { updatedAt: now },
    [
      buildItem({ publishedAt: new Date('2026-03-13T11:30:00.000Z') }),
      buildItem({ publishedAt: new Date('2026-03-13T11:20:00.000Z') }),
      buildItem({ publishedAt: new Date('2026-03-13T11:10:00.000Z') })
    ],
    { now }
  );

  assert.ok(fastStory.signals.velocityScore > slowStory.signals.velocityScore);
  assert.ok(fastStory.storyScore > slowStory.storyScore);
});

test('rankStoryItems prefers stronger sources and marks one primary article', () => {
  const strongSourceId = new ObjectId();
  const weakSourceId = new ObjectId();
  const ranked = rankStoryItems(
    [
      buildItem({
        sourceId: weakSourceId,
        source: { status: 'active', type: 'rss', trustScore: 0.35 },
        publishedAt: new Date('2026-03-13T11:50:00.000Z'),
        clusteringScore: 0.55
      }),
      buildItem({
        sourceId: strongSourceId,
        source: { status: 'active', type: 'rss', trustScore: 0.92 },
        publishedAt: new Date('2026-03-13T11:20:00.000Z'),
        clusteringScore: 0.9
      })
    ],
    { updatedAt: now },
    { now }
  );

  assert.equal(ranked[0].sourceId.toString(), strongSourceId.toString());
  assert.equal(ranked[0].storyItemRanking.isPrimary, true);
  assert.equal(ranked[1].storyItemRanking.isPrimary, false);
});

test('normalizeStorySort defaults to relevant and rejects unsupported values', () => {
  assert.equal(normalizeStorySort(undefined), 'relevant');
  assert.equal(normalizeStorySort('latest'), 'latest');
  assert.throws(() => normalizeStorySort('hot'), /latest, relevant/);
});

test('refreshStoryRanking persists ranking and primary article from ranked items', async () => {
  const storyId = new ObjectId();
  const primaryId = new ObjectId();
  let persistedRanking = null;
  let persistedPrimaryArticleId = null;

  const result = await refreshStoryRanking({
    storyId,
    context: { now },
    deps: {
      findStoryForRanking: async () => ({
        _id: storyId,
        updatedAt: now,
        items: [
          {
            _id: primaryId,
            sourceId: new ObjectId(),
            source: { trustScore: 0.95, status: 'active', type: 'rss' },
            publishedAt: new Date('2026-03-13T11:45:00.000Z'),
            createdAt: new Date('2026-03-13T11:45:00.000Z'),
            clusteringScore: 0.92,
            normalizedDetailedSummary: 'important summary',
            content: 'x'.repeat(2200),
            title: 'Primary item'
          }
        ]
      }),
      updateStoryRanking: async ({ ranking }) => {
        persistedRanking = ranking;
      },
      updateStoryPrimaryArticle: async ({ primaryArticleId }) => {
        persistedPrimaryArticleId = primaryArticleId;
      }
    }
  });

  assert.equal(result.refreshed, true);
  assert.ok(persistedRanking.storyScore > 0);
  assert.equal(String(persistedPrimaryArticleId), String(primaryId));
});
