import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { NORMALIZED_ITEM_COLLECTION } from '../models/NormalizedItem.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(NORMALIZED_ITEM_COLLECTION);
};

const toObjectId = (value) => (value instanceof ObjectId ? value : new ObjectId(value));

export const upsertNormalizedItem = async (item) => {
  const collection = await getCollection();
  const now = new Date();

  const sourceItemId = toObjectId(item.sourceItemId);
  const sourceId = toObjectId(item.sourceId);

  const setPayload = {
    sourceItemId,
    sourceId,
    canonicalUrl: item.canonicalUrl ?? null,
    title: item.title,
    snippet: item.snippet ?? null,
    content: item.content,
    language: item.language,
    entities: item.entities ?? [],
    keywords: item.keywords ?? [],
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    dedupeHash: item.dedupeHash,
    updatedAt: now
  };

  if (Array.isArray(item.embedding) && item.embedding.length) {
    setPayload.embedding = item.embedding;
    setPayload.embeddingModel = item.embeddingModel ?? null;
    setPayload.embeddingCreatedAt = item.embeddingCreatedAt ? new Date(item.embeddingCreatedAt) : now;
  }

  if (item.clusteringStatus) {
    setPayload.clusteringStatus = item.clusteringStatus;
  }

  const result = await collection.findOneAndUpdate(
    { sourceItemId },
    {
      $set: setPayload,
      $setOnInsert: {
        createdAt: now,
        clusteringStatus: item.clusteringStatus ?? 'pending'
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
    .find({
      $or: [{ clusteringStatus: 'pending' }, { clusteringStatus: { $exists: false } }]
    })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
};


export const buildCandidateArticleQuery = (article, options = {}) => {
  const candidateWindowHours = Number(options.candidateWindowHours ?? 72);
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : new Date();
  const windowStart = new Date(publishedAt.getTime() - candidateWindowHours * 60 * 60 * 1000);
  const articleId = article._id ? toObjectId(article._id) : null;

  const query = {
    publishedAt: { $gte: windowStart, $lte: publishedAt },
    embedding: { $exists: true, $ne: [] }
  };

  if (articleId) {
    query._id = { $ne: articleId };
  }

  return query;
};

export const findRecentCandidateArticles = async (article, options = {}) => {
  const collection = await getCollection();

  const maxCandidateArticles = Number(options.maxCandidateArticles ?? 200);
  const query = buildCandidateArticleQuery(article, options);

  return collection
    .find(query, {
      projection: {
        embedding: 1,
        storyId: 1,
        sourceId: 1,
        publishedAt: 1,
        title: 1
      }
    })
    .sort({ publishedAt: -1 })
    .limit(maxCandidateArticles)
    .toArray();
};

export const markNormalizedItemsClustered = async (ids, clusterKey) => {
  if (!ids.length) {
    return;
  }

  const collection = await getCollection();
  const objectIds = ids.map((id) => toObjectId(id));

  await collection.updateMany(
    { _id: { $in: objectIds } },
    {
      $set: {
        clusteredAt: new Date(),
        clusterKey,
        clusteringStatus: 'clustered',
        updatedAt: new Date()
      }
    }
  );
};

export const updateNormalizedItemEmbedding = async (id, payload) => {
  const collection = await getCollection();

  return collection.findOneAndUpdate(
    { _id: toObjectId(id) },
    {
      $set: {
        embedding: payload.embedding,
        embeddingModel: payload.embeddingModel,
        embeddingCreatedAt: payload.embeddingCreatedAt ?? new Date(),
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
};

export const markNormalizedItemClusteringResult = async (id, payload) => {
  const collection = await getCollection();

  return collection.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        storyId: payload.storyId ? toObjectId(payload.storyId) : null,
        clusteredAt: payload.clusteredAt ?? new Date(),
        clusteringStatus: payload.clusteringStatus,
        clusteringScore: payload.clusteringScore ?? null,
        clusteringMetadata: payload.clusteringMetadata ?? null,
        updatedAt: new Date()
      }
    }
  );
};

export const markNormalizedItemClusteringFailed = async (id, reason) => {
  const collection = await getCollection();

  return collection.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        clusteringStatus: 'failed',
        clusteringMetadata: { reason },
        updatedAt: new Date()
      }
    }
  );
};
