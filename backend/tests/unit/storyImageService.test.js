import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

import { refreshStoryHeroImage, selectStoryHeroImage } from '../../src/services/storyImageService.js';

test('selectStoryHeroImage prefers best resolution when dimensions are known', () => {
  const selected = selectStoryHeroImage([
    {
      sourceItemId: new ObjectId('65f1a2b3c4d5e6f7890a1111'),
      image: { url: 'https://example.com/small.jpg', width: 400, height: 250 },
      publishedAt: '2026-01-10T12:00:00.000Z'
    },
    {
      sourceItemId: new ObjectId('65f1a2b3c4d5e6f7890a2222'),
      image: { url: 'https://example.com/large.jpg', width: 1200, height: 630 },
      publishedAt: '2026-01-09T12:00:00.000Z'
    }
  ]);

  assert.equal(selected.url, 'https://example.com/large.jpg');
  assert.equal(String(selected.sourceItemId), '65f1a2b3c4d5e6f7890a2222');
  assert.equal(selected.selectionReason, 'best_resolution');
});

test('selectStoryHeroImage prefers most recent when dimensions are unavailable', () => {
  const selected = selectStoryHeroImage([
    {
      sourceItemId: 'source-item-1',
      image: { url: 'https://example.com/older.jpg' },
      publishedAt: '2026-01-01T12:00:00.000Z'
    },
    {
      sourceItemId: 'source-item-2',
      image: { url: 'https://example.com/newer.jpg' },
      publishedAt: '2026-01-02T12:00:00.000Z'
    }
  ]);

  assert.equal(selected.url, 'https://example.com/newer.jpg');
  assert.equal(selected.selectionReason, 'most_recent');
});

test('selectStoryHeroImage returns null when no valid image exists', () => {
  assert.equal(selectStoryHeroImage([{ image: null }, {}]), null);
});

test('refreshStoryHeroImage recomputes and persists selected hero image', async () => {
  const storyId = new ObjectId();
  let persisted = null;

  const heroImage = await refreshStoryHeroImage({
    storyId,
    deps: {
      listStoryImageCandidates: async () => [
        {
          sourceItemId: new ObjectId('65f1a2b3c4d5e6f7890a3333'),
          image: { url: 'https://example.com/older.jpg' },
          publishedAt: '2026-01-01T12:00:00.000Z'
        },
        {
          sourceItemId: new ObjectId('65f1a2b3c4d5e6f7890a4444'),
          image: { url: 'https://example.com/better.jpg', width: 1280, height: 720 },
          publishedAt: '2026-01-02T12:00:00.000Z'
        }
      ],
      updateStoryHeroImage: async (payload) => {
        persisted = payload;
      }
    }
  });

  assert.equal(heroImage.url, 'https://example.com/better.jpg');
  assert.equal(heroImage.selectionReason, 'best_resolution');
  assert.equal(persisted.storyId, storyId);
  assert.equal(persisted.heroImage.url, 'https://example.com/better.jpg');
});
