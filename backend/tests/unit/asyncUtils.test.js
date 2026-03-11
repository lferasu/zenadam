import assert from 'node:assert/strict';
import test from 'node:test';

import { runWithConcurrency } from '../../src/utils/async.js';

test('runWithConcurrency processes all items', async () => {
  const seen = [];

  await runWithConcurrency({
    items: [1, 2, 3, 4, 5],
    concurrency: 3,
    worker: async (item) => {
      seen.push(item);
    }
  });

  assert.equal(seen.length, 5);
  assert.deepEqual(new Set(seen), new Set([1, 2, 3, 4, 5]));
});
