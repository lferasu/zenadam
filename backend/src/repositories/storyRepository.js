import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { STORY_COLLECTION, STORY_STATUS } from '../models/Story.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(STORY_COLLECTION);
};

export const upsertStoryByClusterKey = async (story) => {
  const collection = await getCollection();
  const now = new Date();

  const itemIds = story.itemIds.map((itemId) => new ObjectId(itemId));
  const sourceIds = story.sourceIds.map((sourceId) => new ObjectId(sourceId));
  const heroItemId = story.heroItemId ? new ObjectId(story.heroItemId) : null;

  const result = await collection.findOneAndUpdate(
    {
      clusterKey: story.clusterKey,
      language: story.language
    },
    {
      $set: {
        title: story.title,
        summary: story.summary,
        heroItemId,
        status: story.status ?? STORY_STATUS.ACTIVE,
        updatedAt: now
      },
      $addToSet: {
        itemIds: { $each: itemIds },
        sourceIds: { $each: sourceIds }
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result;
};

export const listActiveStories = async ({ limit = 50 } = {}) => {
  const collection = await getCollection();

  return collection
    .find({ status: STORY_STATUS.ACTIVE })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
};
