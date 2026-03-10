export const SOURCE_ITEM_COLLECTION = 'source_items';

export const SOURCE_ITEM_INGEST_STATUS = {
  FETCHED: 'fetched',
  NORMALIZED: 'normalized'
};

export const SOURCE_ITEM_NORMALIZATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
};

export const createSourceItemIndexes = async (db) => {
  const collection = db.collection(SOURCE_ITEM_COLLECTION);

  await Promise.all([
    collection.createIndex({ sourceId: 1, externalId: 1 }, { unique: true }),
    collection.createIndex({ sourceId: 1, url: 1 }, { unique: true, sparse: true }),
    collection.createIndex({ sourceId: 1 }),
    collection.createIndex({ externalId: 1 }),
    collection.createIndex({ url: 1 }),
    collection.createIndex({ publishedAt: -1 }),
    collection.createIndex({ ingestStatus: 1, fetchedAt: -1 }),
    collection.createIndex({ normalizationStatus: 1, updatedAt: -1 })
  ]);
};
