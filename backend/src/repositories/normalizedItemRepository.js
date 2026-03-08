import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { NORMALIZED_ITEM_COLLECTION } from '../models/NormalizedItem.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(NORMALIZED_ITEM_COLLECTION);
};

export const upsertNormalizedItem = async (item) => {
  const collection = await getCollection();
  const now = new Date();

  const sourceItemId = new ObjectId(item.sourceItemId);
  const sourceId = new ObjectId(item.sourceId);

  const result = await collection.findOneAndUpdate(
    { sourceItemId },
    {
      $set: {
        sourceItemId,
        sourceId,
        canonicalUrl: item.canonicalUrl ?? null,
        title: item.title,
        content: item.content,
        language: item.language,
        entities: item.entities ?? [],
        keywords: item.keywords ?? [],
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        dedupeHash: item.dedupeHash,
        updatedAt: now
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

export const findUnclusteredNormalizedItems = async (limit = 250) => {
  const collection = await getCollection();

  return collection
    .find({ clusteredAt: { $exists: false } })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
};

export const markNormalizedItemsClustered = async (ids, clusterKey) => {
  if (!ids.length) {
    return;
  }

  const collection = await getCollection();
  const objectIds = ids.map((id) => new ObjectId(id));

  await collection.updateMany(
    { _id: { $in: objectIds } },
    {
      $set: {
        clusteredAt: new Date(),
        clusterKey,
        updatedAt: new Date()
      }
    }
  );
};
