import assert from 'node:assert/strict';
import test from 'node:test';

import { buildArticleEmbedding, cosineSimilarity } from '../../src/services/embeddingService.js';

test('cosineSimilarity returns 1 for identical vectors', () => {
  const score = cosineSimilarity([1, 2, 3], [1, 2, 3]);
  assert.equal(score, 1);
});

test('cosineSimilarity returns 0 for orthogonal vectors', () => {
  const score = cosineSimilarity([1, 0], [0, 1]);
  assert.equal(score, 0);
});

test('buildArticleEmbedding prefers title and normalized detailed summary when available', () => {
  const text = buildArticleEmbedding({
    title: 'Title',
    normalizedDetailedSummary: 'Detailed summary text',
    snippet: 'Snippet text'
  });
  assert.equal(text, 'Title\n\nDetailed summary text');
});

test('buildArticleEmbedding falls back to snippet and then title only', () => {
  const text = buildArticleEmbedding({ title: 'Only title', snippet: 'Snippet text' });
  assert.equal(text, 'Only title\n\nSnippet text');
});

test('buildArticleEmbedding falls back to title only when no richer text is available', () => {
  const text = buildArticleEmbedding({ title: 'Only title', snippet: '', normalizedDetailedSummary: '' });
  assert.equal(text, 'Only title');
});
