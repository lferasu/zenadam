export const STORY_COLLECTION = 'stories';

export const STORY_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived'
};

export const STORY_SUMMARY_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  STALE: 'stale',
  FAILED: 'failed'
};

export const createStoryIndexes = async (db) => {
  const collection = db.collection(STORY_COLLECTION);

  await Promise.all([
    collection.createIndex(
      { clusterKey: 1, language: 1 },
      { unique: true, partialFilterExpression: { clusterKey: { $exists: true } } }
    ),
    collection.createIndex({ status: 1, updatedAt: -1 }),
    collection.createIndex({ language: 1, updatedAt: -1 }),
    collection.createIndex({ storySummaryStatus: 1, updatedAt: -1 }),
    collection.createIndex({ status: 1, 'ranking.storyScore': -1, 'ranking.sortLatestAt': -1 }),
    collection.createIndex({ status: 1, 'ranking.sortLatestAt': -1, updatedAt: -1 })
  ]);
};
