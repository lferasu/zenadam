export const NORMALIZED_ITEM_COLLECTION = 'normalized_items';

export const createNormalizedItemIndexes = async (db) => {
  const collection = db.collection(NORMALIZED_ITEM_COLLECTION);

  await Promise.all([
    collection.createIndex({ sourceItemId: 1 }, { unique: true }),
    collection.createIndex({ sourceId: 1, publishedAt: -1 }),
    collection.createIndex({ dedupeHash: 1 }),
    collection.createIndex({ language: 1, clusterKey: 1 }),
    collection.createIndex({ clusteredAt: 1 })
  ]);
};
