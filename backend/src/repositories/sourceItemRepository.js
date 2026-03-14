import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import {
  SOURCE_ITEM_COLLECTION,
  SOURCE_ITEM_INGEST_STATUS,
  SOURCE_ITEM_NORMALIZATION_STATUS
} from '../models/SourceItem.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(SOURCE_ITEM_COLLECTION);
};

export const upsertSourceItem = async (item) => {
  const collection = await getCollection();
  const now = new Date();
  const sourceId = new ObjectId(item.sourceId);
  const externalId = item.externalId || item.url;
  const updatePayload = {
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
      normalizationStatus: SOURCE_ITEM_NORMALIZATION_STATUS.PENDING,
      normalizationError: null,
      updatedAt: now
    },
    $setOnInsert: {
      createdAt: now
    }
  };

  if (item.image?.url) {
    updatePayload.$set.image = {
      url: item.image.url,
      source: item.image.source,
      ...(item.image.width ? { width: item.image.width } : {}),
      ...(item.image.height ? { height: item.image.height } : {}),
      status: item.image.status ?? 'found'
    };
  }

  try {
    const result = await collection.updateOne({ sourceId, externalId }, updatePayload, { upsert: true });
    return { inserted: result.upsertedCount > 0 };
  } catch (error) {
    // If externalId changed but URL is the same, treat as the same source item.
    if (error?.code === 11000 && item.url) {
      const fallbackResult = await collection.updateOne({ sourceId, url: item.url }, updatePayload, { upsert: true });
      return { inserted: fallbackResult.upsertedCount > 0 };
    }

    throw error;
  }
};

export const findItemsByIngestStatus = async (status, limit = 100) => {
  const collection = await getCollection();

  return collection
    .find({ ingestStatus: status })
    .sort({ publishedAt: -1, fetchedAt: -1 })
    .limit(limit)
    .toArray();
};

export const findPendingNormalizationSourceItems = async (limit = 100) => {
  const collection = await getCollection();

  return collection
    .find({
      ingestStatus: SOURCE_ITEM_INGEST_STATUS.FETCHED,
      $or: [
        { normalizationStatus: SOURCE_ITEM_NORMALIZATION_STATUS.PENDING },
        { normalizationStatus: SOURCE_ITEM_NORMALIZATION_STATUS.FAILED },
        { normalizationStatus: { $exists: false } }
      ]
    })
    .sort({ publishedAt: -1, fetchedAt: -1 })
    .limit(limit)
    .toArray();
};

export const markSourceItemNormalizationProcessing = async (id) => {
  const collection = await getCollection();

  return collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        normalizationStatus: SOURCE_ITEM_NORMALIZATION_STATUS.PROCESSING,
        normalizationError: null,
        updatedAt: new Date()
      }
    }
  );
};

export const markSourceItemNormalizationReady = async (id, payload) => {
  const collection = await getCollection();
  const now = new Date();

  return collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ingestStatus: SOURCE_ITEM_INGEST_STATUS.NORMALIZED,
        sourceLanguage: payload.sourceLanguage,
        targetLanguage: payload.targetLanguage,
        normalizedTitle: payload.normalizedTitle,
        normalizedDetailedSummary: payload.normalizedDetailedSummary,
        normalizedDetailedSummaryStructured: payload.normalizedDetailedSummaryStructured,
        normalizationStatus: SOURCE_ITEM_NORMALIZATION_STATUS.READY,
        normalizationError: null,
        normalizationMetadata: payload.enrichmentMetadata ?? null,
        normalizedSnippet: payload.snippet ?? null,
        normalizationUpdatedAt: now,
        updatedAt: now
      }
    }
  );
};

export const markSourceItemNormalizationFailed = async (id, errorMessage, metadata = null) => {
  const collection = await getCollection();

  return collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        normalizationStatus: SOURCE_ITEM_NORMALIZATION_STATUS.FAILED,
        normalizationError: errorMessage,
        normalizationMetadata: metadata,
        normalizationUpdatedAt: new Date(),
        updatedAt: new Date()
      }
    }
  );
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
