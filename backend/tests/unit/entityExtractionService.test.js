import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeTypedEntities } from '../../src/services/entityExtractionService.js';

test('mergeTypedEntities deduplicates persons and locations', () => {
  const merged = mergeTypedEntities(
    { persons: ['Abiy Ahmed', 'abiy ahmed'], locations: ['Dire Dawa'] },
    { persons: ['Abiy Ahmed'], locations: ['dire dawa', 'Ethiopia'] }
  );

  assert.deepEqual(merged.persons, ['Abiy Ahmed']);
  assert.deepEqual(merged.locations, ['Dire Dawa', 'Ethiopia']);
});
