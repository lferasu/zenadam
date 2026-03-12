import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminSourcesHandlers } from '../../src/controllers/adminSources.controller.js';

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

test('admin list source works', async () => {
  const handlers = createAdminSourcesHandlers({
    listAdminSources: async () => [
      {
        id: 'source-1',
        slug: 'bbc-amharic',
        name: 'BBC Amharic',
        type: 'rss',
        baseUrl: 'https://www.bbc.com/amharic',
        feedUrl: 'https://feeds.bbci.co.uk/amharic/rss.xml',
        language: 'am',
        isActive: true,
        validationStatus: 'valid',
        lastValidatedAt: '2026-01-01T00:00:00.000Z',
        lastValidationMessage: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ]
  });

  const req = { query: {}, requestId: 'req-4' };
  const res = createResponse();
  await handlers.listSources(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].slug, 'bbc-amharic');
});

test('admin get source works', async () => {
  const handlers = createAdminSourcesHandlers({
    getAdminSourceById: async () => ({
      id: 'source-1',
      slug: 'bbc-amharic',
      name: 'BBC Amharic',
      type: 'rss',
      baseUrl: 'https://www.bbc.com/amharic',
      feedUrl: 'https://feeds.bbci.co.uk/amharic/rss.xml',
      language: 'am',
      isActive: true,
      validationStatus: 'valid',
      lastValidatedAt: '2026-01-01T00:00:00.000Z',
      lastValidationMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    })
  });

  const req = { params: { sourceId: 'source-1' }, requestId: 'req-5' };
  const res = createResponse();
  await handlers.getSourceById(req, res, (error) => {
    throw error;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, 'source-1');
  assert.equal(res.body.error, null);
});
