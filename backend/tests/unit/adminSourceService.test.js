import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminSourceService } from '../../src/services/adminSourceService.js';

const sampleRssXml = `<?xml version="1.0"?>
<rss><channel><item><title>Sample title</title><description>Sample description</description><link>https://example.com/a</link></item></channel></rss>`;

test('admin validate returns valid result for good source input', async () => {
  const service = createAdminSourceService({
    fetchFeedXml: async () => ({ xml: sampleRssXml, notModified: false }),
    detectLanguage: () => 'en'
  });

  const result = await service.validateCandidateSource({
    slug: 'sample-source',
    name: 'Sample Source',
    type: 'rss',
    baseUrl: 'https://example.com',
    feedUrl: 'https://example.com/feed.xml'
  });

  assert.equal(result.isValid, true);
  assert.equal(result.normalizedType, 'rss');
  assert.equal(result.sampleCount, 1);
});

test('admin validate returns invalid result for bad source input', async () => {
  const service = createAdminSourceService({
    fetchFeedXml: async () => {
      throw new Error('RSS fetch failed (404) for https://example.com/feed.xml');
    },
    findSourceByBaseUrl: async () => null,
    findSourceByEntryUrl: async () => null,
    findSourceBySlug: async () => null
  });

  const result = await service.validateCandidateSource({
    slug: 'bad-source',
    name: 'Bad Source',
    type: 'rss',
    baseUrl: 'https://example.com',
    feedUrl: 'https://example.com/feed.xml'
  });

  assert.equal(result.isValid, false);
  assert.match(result.issues[0], /404/);
});

test('admin create rejects invalid source input', async () => {
  const service = createAdminSourceService({
    fetchFeedXml: async () => {
      throw new Error('RSS fetch failed (404) for https://example.com/feed.xml');
    }
  });

  await assert.rejects(
    () =>
      service.createAdminSource({
        slug: 'bad-source',
        name: 'Bad Source',
        type: 'rss',
        baseUrl: 'https://example.com',
        feedUrl: 'https://example.com/feed.xml'
      }),
    (error) => error.code === 'INVALID_SOURCE_INPUT'
  );
});

test('admin create rejects duplicate slug', async () => {
  const service = createAdminSourceService({
    fetchFeedXml: async () => ({ xml: sampleRssXml, notModified: false }),
    detectLanguage: () => 'en',
    findSourceBySlug: async () => ({ _id: 'existing-source', slug: 'duplicate-source' }),
    findSourceByBaseUrl: async () => null,
    findSourceByEntryUrl: async () => null
  });

  await assert.rejects(
    () =>
      service.createAdminSource({
        slug: 'duplicate-source',
        name: 'Duplicate Source',
        type: 'rss',
        baseUrl: 'https://example.com',
        feedUrl: 'https://example.com/feed.xml'
      }),
    (error) => error.code === 'DUPLICATE_SOURCE_SLUG'
  );
});

test('admin update revalidates relevant changes', async () => {
  let validatedFeedUrl = null;

  const service = createAdminSourceService({
    findSourceById: async () => ({
      _id: 'source-1',
      slug: 'source-1',
      name: 'Source One',
      type: 'rss',
      baseUrl: 'https://example.com',
      entryUrls: ['https://example.com/old.xml'],
      language: 'en',
      status: 'active'
    }),
    fetchFeedXml: async (feedUrl) => {
      validatedFeedUrl = feedUrl;
      return { xml: sampleRssXml, notModified: false };
    },
    detectLanguage: () => 'en',
    findSourceByBaseUrl: async () => null,
    findSourceByEntryUrl: async () => null,
    findSourceBySlug: async () => null,
    updateSourceById: async (id, updates) => ({
      _id: id,
      ...updates,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    })
  });

  const updated = await service.updateAdminSource({
    id: '65f0e3ccf75e61a5a4f99991',
    input: {
      feedUrl: 'https://example.com/new.xml'
    }
  });

  assert.equal(validatedFeedUrl, 'https://example.com/new.xml');
  assert.equal(updated.feedUrl, 'https://example.com/new.xml');
});
