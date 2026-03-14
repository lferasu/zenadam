import assert from 'node:assert/strict';
import test from 'node:test';

import { extractImageFromRssEntry } from '../../src/ingestion/rss/rssImageExtractor.js';

test('extractImageFromRssEntry prefers media:content first', () => {
  const result = extractImageFromRssEntry({
    'media:content': [
      { url: 'https://example.com/images/hero.jpg', width: '1200', height: '630' }
    ],
    enclosure: { url: 'https://example.com/images/fallback.jpg', type: 'image/jpeg' }
  });

  assert.deepEqual(result, {
    url: 'https://example.com/images/hero.jpg',
    source: 'rss_media_content',
    width: 1200,
    height: 630
  });
});

test('extractImageFromRssEntry falls back through priority order', () => {
  const result = extractImageFromRssEntry({
    enclosure: { url: 'https://example.com/images/enclosure.jpg', type: 'image/jpeg' }
  });

  assert.deepEqual(result, {
    url: 'https://example.com/images/enclosure.jpg',
    source: 'rss_enclosure'
  });
});

test('extractImageFromRssEntry extracts the first image from content html when feed media fields are absent', () => {
  const result = extractImageFromRssEntry({
    'content:encoded': '<p>lead</p><img src="https://example.com/images/content-photo.png" />'
  });

  assert.deepEqual(result, {
    url: 'https://example.com/images/content-photo.png',
    source: 'rss_content_image'
  });
});

test('extractImageFromRssEntry rejects invalid, tiny, or logo-like candidates', () => {
  assert.equal(
    extractImageFromRssEntry({
      'media:content': { url: '/images/relative.jpg', width: '800', height: '400' }
    }),
    null
  );

  assert.equal(
    extractImageFromRssEntry({
      'media:thumbnail': { url: 'https://example.com/images/thumb.jpg', width: '120', height: '60' }
    }),
    null
  );

  assert.equal(
    extractImageFromRssEntry({
      enclosure: { url: 'https://example.com/assets/logo.png', type: 'image/png' }
    }),
    null
  );
});
