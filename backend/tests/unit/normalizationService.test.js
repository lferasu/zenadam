import assert from 'node:assert/strict';
import test from 'node:test';

import { detectLanguage } from '../../src/services/normalizationService.js';

test('detectLanguage returns am for Amharic unicode text', () => {
  assert.equal(detectLanguage('ይህ አማርኛ ነው'), 'am');
});

test('detectLanguage defaults to en', () => {
  assert.equal(detectLanguage('This is English text'), 'en');
});
