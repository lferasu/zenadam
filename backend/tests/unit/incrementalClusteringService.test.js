import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateStoryCandidates, selectClusteringAction } from '../../src/services/incrementalClusteringService.js';

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
