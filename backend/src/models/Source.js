export const SOURCE_COLLECTION = 'sources';

export const SOURCE_TYPES = {
  RSS: 'rss',
  SCRAPER: 'scraper',
  API: 'api'
};

export const SOURCE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

export const createSourceIndexes = async (db) => {
  const collection = db.collection(SOURCE_COLLECTION);

  await Promise.all([
    collection.createIndex({ slug: 1 }, { unique: true }),
    collection.createIndex({ status: 1, type: 1 }),
    collection.createIndex({ 'sourceQuality.score': -1, status: 1 })
  ]);
};
