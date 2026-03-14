import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';
import { getDb } from '../config/database.js';
import { NORMALIZED_ITEM_COLLECTION } from '../models/NormalizedItem.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(NORMALIZED_ITEM_COLLECTION);
};

const toObjectId = (value) => (value instanceof ObjectId ? value : new ObjectId(value));

const toDate = (value) => (value ? new Date(value) : new Date());

export const upsertNormalizedItem = async (item) => {
  const collection = await getCollection();
  const now = new Date();

  const sourceItemId = toObjectId(item.sourceItemId);
  const sourceId = toObjectId(item.sourceId);

  const setPayload = {
    sourceItemId,
    sourceId,
    canonicalUrl: item.canonicalUrl ?? null,
    sourceLanguage: item.sourceLanguage ?? item.language,
    targetLanguage: item.targetLanguage ?? item.language,
    titleOriginal: item.titleOriginal ?? null,
    contentOriginal: item.contentOriginal ?? null,
    normalizedTitle: item.normalizedTitle ?? item.title,
    title: item.title,
    snippet: item.snippet ?? null,
    content: item.content,
    normalizedDetailedSummary: item.normalizedDetailedSummary ?? null,
    structuredSummary: item.structuredSummary ?? item.normalizedDetailedSummaryStructured ?? null,
    normalizedDetailedSummaryStructured: item.normalizedDetailedSummaryStructured ?? item.structuredSummary ?? null,
    embeddingInput: item.embeddingInput ?? null,
    language: item.language,
    entities: item.entities ?? [],
    persons: item.persons ?? [],
    locations: item.locations ?? [],
    keywords: item.keywords ?? [],
    topicFingerprint: item.topicFingerprint ?? null,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    dedupeHash: item.dedupeHash,
    enrichmentStatus: item.enrichmentStatus ?? 'succeeded',
    enrichmentMetadata: item.enrichmentMetadata ?? null,
    updatedAt: now
  };

  if (item.image?.url) {
    setPayload.image = {
      url: item.image.url,
      source: item.image.source,
      ...(item.image.width ? { width: item.image.width } : {}),
      ...(item.image.height ? { height: item.image.height } : {}),
      ...(item.image.status ? { status: item.image.status } : {})
    };
  }

  if (Array.isArray(item.embedding) && item.embedding.length) {
    setPayload.embedding = item.embedding;
    setPayload.embeddingModel = item.embeddingModel ?? null;
    setPayload.embeddingCreatedAt = item.embeddingCreatedAt ? new Date(item.embeddingCreatedAt) : now;
  }

  if (item.clusteringStatus) {
    setPayload.clusteringStatus = item.clusteringStatus;
  }

  const setOnInsertPayload = {
    createdAt: now
  };

  if (!item.clusteringStatus) {
    setOnInsertPayload.clusteringStatus = 'pending';
  }

  const result = await collection.findOneAndUpdate(
    { sourceItemId },
    {
      $set: setPayload,
      $setOnInsert: setOnInsertPayload
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result;
};

export const listStoryImageCandidates = async (storyId) => {
  const collection = await getCollection();

  return collection
    .find(
      { storyId: toObjectId(storyId), 'image.url': { $exists: true, $ne: '' } },
      {
        projection: {
          _id: 1,
          sourceItemId: 1,
          image: 1,
          publishedAt: 1,
          updatedAt: 1,
          createdAt: 1
        }
      }
    )
    .toArray();
};

export const findUnclusteredNormalizedItems = async (limit = 250) => {
  const collection = await getCollection();

  return collection
    .find({
      $and: [
        { $or: [{ clusteringStatus: 'pending' }, { clusteringStatus: { $exists: false } }] },
        { $or: [{ enrichmentStatus: 'succeeded' }, { enrichmentStatus: { $exists: false } }] }
      ]
    })
    // Oldest-first improves single-pass incremental attach behavior because earlier
    // items get storyIds before later related items are clustered.
    .sort({ publishedAt: 1, createdAt: 1 })
    .limit(limit)
    .toArray();
};

export const buildCandidateArticleQuery = (article, options = {}) => {
  const candidateWindowHours = Number(options.candidateWindowHours ?? 72);
  const candidateForwardWindowHours = Number(options.candidateForwardWindowHours ?? 0);
  const publishedAt = toDate(article.publishedAt);
  const windowStart = new Date(publishedAt.getTime() - candidateWindowHours * 60 * 60 * 1000);
  const windowEnd = new Date(publishedAt.getTime() + candidateForwardWindowHours * 60 * 60 * 1000);
  const articleId = article._id ? toObjectId(article._id) : null;

  const query = {
    publishedAt: { $gte: windowStart, $lte: windowEnd },
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
        title: 1,
        canonicalUrl: 1,
        keywords: 1,
        entities: 1,
        persons: 1,
        locations: 1,
        topicFingerprint: 1
      }
    })
    .sort({ publishedAt: -1 })
    .limit(maxCandidateArticles)
    .toArray();
};

export const buildNearestVectorPipeline = ({
  articleId,
  embedding,
  publishedAt,
  candidateWindowHours,
  candidateForwardWindowHours = 0,
  limit,
  numCandidates,
  indexName
}) => {
  const publishedAtDate = toDate(publishedAt);
  const windowStart = new Date(publishedAtDate.getTime() - Number(candidateWindowHours) * 60 * 60 * 1000);
  const windowEnd = new Date(publishedAtDate.getTime() + Number(candidateForwardWindowHours) * 60 * 60 * 1000);

  const vectorFilter = {
    embedding: { $exists: true },
    publishedAt: {
      $gte: windowStart,
      $lte: windowEnd
    }
  };

  return [
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: embedding,
        numCandidates: Number(numCandidates),
        limit: Number(limit),
        filter: vectorFilter
      }
    },
    {
      $project: {
        _id: 1,
        storyId: 1,
        sourceId: 1,
        publishedAt: 1,
        title: 1,
        canonicalUrl: 1,
        keywords: 1,
        entities: 1,
        persons: 1,
        locations: 1,
        topicFingerprint: 1,
        similarity: { $meta: 'vectorSearchScore' }
      }
    }
  ];
};

export const findNearestCandidateArticlesByVector = async ({
  articleId,
  embedding,
  publishedAt,
  candidateWindowHours = env.CANDIDATE_WINDOW_HOURS,
  candidateForwardWindowHours = env.CANDIDATE_FORWARD_WINDOW_HOURS,
  limit = env.MAX_NEAREST_ARTICLES,
  numCandidates = env.VECTOR_NUM_CANDIDATES,
  indexName = env.VECTOR_SEARCH_INDEX_NAME
}) => {
  if (!Array.isArray(embedding) || !embedding.length) {
    return [];
  }

  const collection = await getCollection();
  const pipeline = buildNearestVectorPipeline({
    articleId,
    embedding,
    publishedAt,
    candidateWindowHours,
    candidateForwardWindowHours,
    limit,
    numCandidates,
    indexName
  });

  const candidates = await collection.aggregate(pipeline).toArray();

  const windowStart = new Date(toDate(publishedAt).getTime() - Number(candidateWindowHours) * 60 * 60 * 1000);
  const windowEnd = new Date(toDate(publishedAt).getTime() + Number(candidateForwardWindowHours) * 60 * 60 * 1000);

  return candidates.filter((candidate) => {
    const candidatePublishedAt = candidate.publishedAt ? new Date(candidate.publishedAt) : null;
    if (!candidatePublishedAt) {
      return false;
    }

    if (candidatePublishedAt < windowStart || candidatePublishedAt > windowEnd) {
      return false;
    }

    if (articleId && String(candidate._id) === String(articleId)) {
      return false;
    }

    return true;
  });
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

export const findRepresentativeNormalizedItemForStory = async (storyId) => {
  const collection = await getCollection();

  return collection.findOne(
    {
      storyId: toObjectId(storyId),
      embedding: { $exists: true, $ne: [] }
    },
    {
      sort: { publishedAt: -1, updatedAt: -1 }
    }
  );
};

export const reassignStoryForNormalizedItems = async ({ fromStoryId, toStoryId }) => {
  const collection = await getCollection();
  const result = await collection.updateMany(
    { storyId: toObjectId(fromStoryId) },
    {
      $set: {
        storyId: toObjectId(toStoryId),
        updatedAt: new Date()
      }
    }
  );

  return {
    matchedCount: Number(result.matchedCount ?? 0),
    modifiedCount: Number(result.modifiedCount ?? 0)
  };
};
