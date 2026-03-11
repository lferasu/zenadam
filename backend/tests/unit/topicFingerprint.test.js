import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTopicFingerprint } from '../../src/utils/topicFingerprint.js';

test('buildTopicFingerprint carries typed persons and locations from NER input', () => {
  const fingerprint = buildTopicFingerprint({
    title: 'Prime Minister Abiy Ahmed visits Dire Dawa',
    detailedSummary:
      'Prime Minister Abiy Ahmed inspected development projects in Dire Dawa city, Ethiopia, alongside local officials.',
    typedEntities: {
      persons: ['Abiy Ahmed'],
      locations: ['Dire Dawa', 'Ethiopia']
    }
  });

  assert.ok(fingerprint.persons.includes('Abiy Ahmed'));
  assert.ok(fingerprint.locations.includes('Dire Dawa'));
});
