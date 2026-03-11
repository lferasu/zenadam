import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePendingSourceItems } from '../../src/services/normalizationService.js';

test('normalization pipeline marks failed enrichment as not ready for clustering and continues batch', async () => {
  const calls = {
    processing: [],
    ready: [],
    failed: [],
    upserts: []
  };

  const sourceItems = [
    { _id: '1', sourceId: 's1', title: 'ok', rawText: 'ok' },
    { _id: '2', sourceId: 's2', title: 'bad', rawText: 'bad' }
  ];

  const result = await normalizePendingSourceItems({
    limit: 10,
    skipRuntimeInitialization: true,
    concurrency: 1,
    deps: {
      findPendingNormalizationSourceItems: async () => sourceItems,
      markSourceItemNormalizationProcessing: async (id) => calls.processing.push(id),
      upsertNormalizedItem: async (item) => calls.upserts.push(item),
      markSourceItemNormalizationReady: async (id, payload) => calls.ready.push({ id, payload }),
      markSourceItemNormalizationFailed: async (id, message, metadata) => calls.failed.push({ id, message, metadata }),
      enrichSourceItem: async (item) => {
        if (item._id === '2') {
          throw new Error('translation config missing');
        }

        return {
          sourceLanguage: 'am',
          targetLanguage: 'am',
          normalizedItem: {
            sourceItemId: item._id,
            sourceId: item.sourceId,
            title: 'normalized-title',
            normalizedTitle: 'normalized-title',
            normalizedDetailedSummary: 'normalized-summary',
            structuredSummary: { bullets: ['b1'], paragraph: 'p1' },
            snippet: 'normalized-snippet',
            content: 'normalized-summary',
            language: 'am',
            targetLanguage: 'am',
            sourceLanguage: 'am',
            dedupeHash: 'hash',
            enrichmentStatus: 'succeeded',
            enrichmentMetadata: { ok: true },
            embedding: [0.1, 0.2],
            embeddingCreatedAt: new Date('2026-01-10T12:00:00.000Z')
          }
        };
      }
    }
  });

  assert.deepEqual(result, {
    scanned: 2,
    normalizedCount: 1,
    failedCount: 1
  });
  assert.deepEqual(calls.processing, ['1', '2']);
  assert.equal(calls.upserts.length, 1);
  assert.equal(calls.ready.length, 1);
  assert.equal(calls.failed.length, 1);
  assert.equal(calls.failed[0].id, '2');
  assert.match(calls.failed[0].message, /translation config missing/);
  assert.equal(calls.ready[0].payload.enrichmentMetadata.embeddingCreatedAt.toISOString(), '2026-01-10T12:00:00.000Z');
});
