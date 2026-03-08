import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { SOURCE_ITEM_COLLECTION, SOURCE_ITEM_INGEST_STATUS } from '../models/SourceItem.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(SOURCE_ITEM_COLLECTION);
};

export const upsertSourceItem = async (item) => {
  const collection = await getCollection();
  const now = new Date();
  const sourceId = new ObjectId(item.sourceId);
  const externalId = item.externalId || item.url;

  const result = await collection.findOneAndUpdate(
    { sourceId, externalId },
    {
      $set: {
        sourceId,
        externalId,
        url: item.url,
        title: item.title,
        rawPayload: item.rawPayload ?? null,
        rawText: item.rawText ?? null,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        fetchedAt: item.fetchedAt ? new Date(item.fetchedAt) : now,
        ingestStatus: SOURCE_ITEM_INGEST_STATUS.FETCHED,
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

export const findItemsByIngestStatus = async (status, limit = 100) => {
  const collection = await getCollection();

  return collection
    .find({ ingestStatus: status })
    .sort({ publishedAt: -1, fetchedAt: -1 })
    .limit(limit)
    .toArray();
};

export const markSourceItemNormalized = async (id) => {
  const collection = await getCollection();

  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ingestStatus: SOURCE_ITEM_INGEST_STATUS.NORMALIZED,
        updatedAt: new Date()
      }
    }
  );
};
