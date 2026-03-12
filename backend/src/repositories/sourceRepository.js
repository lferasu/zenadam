import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { SOURCE_COLLECTION, SOURCE_STATUS } from '../models/Source.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(SOURCE_COLLECTION);
};

export const findSourceBySlug = async (slug) => {
  const collection = await getCollection();
  return collection.findOne({ slug });
};

export const listSources = async ({ status, type, limit = 100, skip = 0 } = {}) => {
  const collection = await getCollection();
  const query = {};

  if (status) {
    query.status = status;
  }

  if (type) {
    query.type = type;
  }

  return collection.find(query).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(limit).toArray();
};

export const findActiveSourcesByType = async (type) => {
  const collection = await getCollection();
  const query = { status: SOURCE_STATUS.ACTIVE };

  if (type) {
    query.type = type;
  }

  return collection.find(query).toArray();
};

export const updateSourceAuditState = async (sourceId, auditState) => {
  const collection = await getCollection();
  const now = new Date();

  await collection.updateOne(
    { _id: new ObjectId(sourceId) },
    {
      $set: {
        healthStatus: auditState.healthStatus,
        healthReason: auditState.healthReason ?? null,
        healthFreshness: auditState.healthFreshness ?? null,
        healthScrapable: auditState.healthScrapable ?? null,
        healthItemCount: auditState.healthItemCount ?? null,
        healthLastCheckedAt: now,
        healthLastSuccessfulFetchAt: auditState.healthLastSuccessfulFetchAt ?? null,
        updatedAt: now
      },
      ...(auditState.incrementFailureCount
        ? { $inc: { healthFailureCount: 1 } }
        : {})
    }
  );
};

export const upsertSourceBySlug = async (source) => {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { slug: source.slug },
    {
      $set: {
        ...source,
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

export const findSourceById = async (id) => {
  const collection = await getCollection();
  return collection.findOne({ _id: new ObjectId(id) });
};

export const findSourceByBaseUrl = async (baseUrl) => {
  const collection = await getCollection();
  return collection.findOne({ baseUrl });
};

export const findSourceByEntryUrl = async (entryUrl) => {
  const collection = await getCollection();
  return collection.findOne({ entryUrls: entryUrl });
};

export const createSource = async (source) => {
  const collection = await getCollection();
  const now = new Date();
  const document = {
    ...source,
    createdAt: now,
    updatedAt: now
  };

  const result = await collection.insertOne(document);
  return collection.findOne({ _id: result.insertedId });
};

export const updateSourceById = async (id, updates) => {
  const collection = await getCollection();

  return collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...updates,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
};

export const deleteSourcesByIds = async (sourceIds = []) => {
  if (!sourceIds.length) {
    return { deletedCount: 0 };
  }

  const collection = await getCollection();
  const objectIds = sourceIds.map((id) => new ObjectId(id));
  const result = await collection.deleteMany({ _id: { $in: objectIds } });

  return {
    deletedCount: Number(result.deletedCount ?? 0)
  };
};
