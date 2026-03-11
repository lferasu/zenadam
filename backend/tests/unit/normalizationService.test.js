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
    body: [
      'The city council approved the 2026 budget after a long session.',
      'It includes transport and health allocations.',
      'Opposition members requested stronger oversight language.',
      'The mayor said implementation would start next quarter.',
      'Community groups welcomed the school funding increase.',
      'A final procedural vote is still expected next week.',
      'Regional agencies are expected to publish implementation calendars after the budget clears.',
      'Several department heads said staffing decisions depend on the final appropriations schedule.',
      'The debate also focused on how quickly the new public health spending can reach local clinics.',
      'Residents packed the chamber and pressed officials for clearer accountability milestones.'
    ].join(' '),
    targetLanguage: 'am'
  });

  assert.equal(result.targetLanguage, 'am');
  assert.equal(typeof result.normalizedTitle, 'string');
  assert.equal(typeof result.normalizedDetailedSummary, 'string');
  assert.equal(typeof result.normalizedDetailedSummaryStructured, 'object');
  assert.ok(Array.isArray(result.normalizedDetailedSummaryStructured.bullets));
  assert.ok(result.normalizedDetailedSummaryStructured.bullets.length >= 3);
  assert.ok(result.normalizedDetailedSummaryStructured.bullets.length <= 5);
  assert.equal(typeof result.normalizedDetailedSummaryStructured.paragraph, 'string');
  assert.ok(result.normalizedTitle.length > 0);
  assert.ok(result.normalizedDetailedSummary.length > 500);
  assert.ok(result.normalizedDetailedSummaryStructured.paragraph.split(/\s+/).filter(Boolean).length >= 40);
  assert.match(result.normalizedDetailedSummary, /\n- /);
  assert.match(result.normalizedDetailedSummary, /ተጨማሪ ማብራሪያ፡/);
});
