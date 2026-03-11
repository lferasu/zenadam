import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSourceItemEnrichment } from '../../src/services/sourceItemEnrichmentService.js';
import { env } from '../../src/config/env.js';

test('enrichment succeeds when source language equals target language', async () => {
  const result = await buildSourceItemEnrichment(
    {
      _id: '65f0e3ccf75e61a5a4f12345',
      sourceId: '65f0e3ccf75e61a5a4f99999',
      title: 'የከተማ ካውንስል በጀት አጸደቀ',
      rawText: 'የከተማ ካውንስል በ2026 በጀት ላይ ውሳኔ አሳለፈ።',
      url: 'https://example.com/story',
      publishedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      targetLanguage: 'am',
      deps: {
        detectLanguage: () => 'am',
        translateText: async ({ text }) => text,
        translateStructuredSummary: async ({ structuredSummary }) => structuredSummary,
        extractTypedEntities: async () => ({ persons: [], locations: [] })
      }
    }
  );

  assert.equal(result.sourceLanguage, 'am');
  assert.equal(result.normalizedItem.targetLanguage, 'am');
  assert.equal(result.normalizedItem.language, 'am');
  assert.equal(result.normalizedItem.enrichmentStatus, 'succeeded');
  assert.equal(typeof result.normalizedItem.normalizedTitle, 'string');
  assert.equal(typeof result.normalizedItem.normalizedDetailedSummary, 'string');
  assert.ok(result.normalizedItem.structuredSummary.bullets.length >= 1);
});

test('enrichment translates user-facing fields when source language differs from target language', async () => {
  const result = await buildSourceItemEnrichment(
    {
      _id: '65f0e3ccf75e61a5a4f12346',
      sourceId: '65f0e3ccf75e61a5a4f99998',
      title: 'City council approves budget',
      rawText: 'The city council approved a spending plan and published oversight details.'
    },
    {
      targetLanguage: 'am',
      deps: {
        detectLanguage: () => 'en',
        translateText: async ({ text }) => `am:${text}`,
        translateStructuredSummary: async () => ({ bullets: ['am:b1'], paragraph: 'am:p' }),
        extractTypedEntities: async () => ({ persons: [], locations: [] })
      }
    }
  );

  assert.equal(result.sourceLanguage, 'en');
  assert.equal(result.normalizedItem.targetLanguage, 'am');
  assert.match(result.normalizedItem.normalizedTitle, /^am:/);
  assert.match(result.normalizedItem.normalizedDetailedSummary, /^am:/);
  assert.deepEqual(result.normalizedItem.structuredSummary, { bullets: ['am:b1'], paragraph: 'am:p' });
  assert.match(result.normalizedItem.snippet, /^am:/);
});

test('translation requirement fails explicitly when config is missing', async () => {
  const originalApiKey = env.OPENAI_API_KEY;
  env.OPENAI_API_KEY = '';

  try {
    await assert.rejects(
      () =>
        buildSourceItemEnrichment(
          {
            _id: '65f0e3ccf75e61a5a4f12347',
            sourceId: '65f0e3ccf75e61a5a4f99997',
            title: 'City council approves budget',
            rawText: 'English body.'
          },
          { targetLanguage: 'am', deps: { detectLanguage: () => 'en' } }
        ),
      /Translation required but OPENAI_API_KEY is not configured/
    );
  } finally {
    env.OPENAI_API_KEY = originalApiKey;
  }
});
