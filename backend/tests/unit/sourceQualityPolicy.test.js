import assert from 'node:assert/strict';
import test from 'node:test';

import { getSourceRankScore } from '../../src/ranking/sourceRank.js';
import {
  inferSourceQuality,
  normalizeSourceQuality,
  resolveSourceQuality,
  SOURCE_QUALITY_STRATEGY_VERSION
} from '../../src/ranking/sourceQualityPolicy.js';

test('getSourceRankScore prefers sourceQuality.score when present', () => {
  assert.equal(
    getSourceRankScore({
      sourceQuality: { score: 0.87 },
      trustScore: 0.2
    }),
    0.87
  );
});

test('inferSourceQuality returns curated backfill quality for known source slug', () => {
  const quality = inferSourceQuality({
    source: {
      slug: 'bbc-amharic',
      status: 'active',
      type: 'rss'
    },
    sourceSet: 'sources'
  });

  assert.equal(quality.score, 0.95);
  assert.equal(quality.tier, 'high');
  assert.equal(quality.isBackfilled, true);
  assert.equal(quality.strategyVersion, SOURCE_QUALITY_STRATEGY_VERSION);
});

test('resolveSourceQuality assigns candidate default when no explicit value exists', () => {
  const quality = resolveSourceQuality({
    input: { type: 'rss', status: 'candidate' },
    existing: {},
    sourceSet: 'candidate_sources'
  });

  assert.equal(quality.score, 0.5);
  assert.equal(quality.rationale, 'candidate_default_pending_review');
});

test('normalizeSourceQuality accepts numeric manual scores', () => {
  const quality = normalizeSourceQuality(82);
  assert.equal(quality.score, 0.82);
  assert.equal(quality.tier, 'medium');
});
