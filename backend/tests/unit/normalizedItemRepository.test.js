import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

import { buildCandidateArticleQuery } from '../../src/repositories/normalizedItemRepository.js';

test('buildCandidateArticleQuery sets candidate time window and excludes current article', () => {
  const articleId = new ObjectId();
  const publishedAt = new Date('2026-01-10T12:00:00.000Z');

  const query = buildCandidateArticleQuery(
    { _id: articleId, publishedAt },
    { candidateWindowHours: 72 }
  );

  assert.equal(query._id.$ne.toString(), articleId.toString());
  assert.equal(query.publishedAt.$lte.toISOString(), '2026-01-10T12:00:00.000Z');
  assert.equal(query.publishedAt.$gte.toISOString(), '2026-01-07T12:00:00.000Z');
  assert.deepEqual(query.embedding, { $exists: true, $ne: [] });
});
