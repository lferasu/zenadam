import assert from 'node:assert/strict';
import test from 'node:test';

import { detectLanguage, generateSourceItemNormalization } from '../../src/ai/index.js';

test('detectLanguage returns am for Amharic unicode text', () => {
  assert.equal(detectLanguage('ይህ አማርኛ ነው'), 'am');
});

test('detectLanguage defaults to en', () => {
  assert.equal(detectLanguage('This is English text'), 'en');
});

test('generateSourceItemNormalization always returns normalized title and detailed summary in target language', async () => {
  const result = await generateSourceItemNormalization({
    title: 'Breaking: City council approves budget',
    body: 'The city council approved the 2026 budget after a long session. It includes transport and health allocations.',
    targetLanguage: 'am'
  });

  assert.equal(result.targetLanguage, 'am');
  assert.equal(typeof result.normalizedTitle, 'string');
  assert.equal(typeof result.normalizedDetailedSummary, 'string');
  assert.ok(result.normalizedTitle.length > 0);
  assert.ok(result.normalizedDetailedSummary.length > 0);
});
