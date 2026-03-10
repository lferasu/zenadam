import assert from 'node:assert/strict';
import test from 'node:test';

import { generateStorySummary } from '../../src/ai/index.js';

test('generateStorySummary returns story title and summary in configured target language shape', async () => {
  const result = await generateStorySummary({
    articles: [
      { title: 'Election board announces final vote count', snippet: 'Final totals were released after regional verification.' },
      { title: 'Observers react to vote count release', snippet: 'Regional observers called for calm and accepted the tally.' }
    ],
    targetLanguage: 'am'
  });

  assert.equal(result.targetLanguage, 'am');
  assert.equal(typeof result.storyTitle, 'string');
  assert.equal(typeof result.storySummary, 'string');
  assert.ok(result.storyTitle.length > 0);
  assert.ok(result.storySummary.length > 0);
});
