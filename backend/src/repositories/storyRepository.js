import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';
import { getDb } from '../config/database.js';
import { STORY_COLLECTION, STORY_STATUS } from '../models/Story.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(STORY_COLLECTION);
};

const toObjectId = (value) => (value instanceof ObjectId ? value : new ObjectId(value));

export const upsertStoryByClusterKey = async (story) => {
  const collection = await getCollection();
  const now = new Date();

  const itemIds = story.itemIds.map((itemId) => toObjectId(itemId));
  const sourceIds = story.sourceIds.map((sourceId) => toObjectId(sourceId));
  const heroItemId = story.heroItemId ? toObjectId(story.heroItemId) : null;

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

export const createStoryFromArticle = async (article) => {
  const collection = await getCollection();
  const now = new Date();

  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : now;
  const sourceId = toObjectId(article.sourceId);
  const heroArticleId = article._id ? toObjectId(article._id) : toObjectId(article.sourceItemId);

  const result = await collection.insertOne({
    title: article.title,
    summary: article.snippet ?? null,
    heroArticleId,
    itemIds: [toObjectId(article.sourceItemId)],
    sourceIds: [sourceId],
    articleCount: 1,
    sourceCount: 1,
    firstSeenAt: publishedAt,
    lastSeenAt: now,
    lastArticlePublishedAt: publishedAt,
    language: article.language ?? 'en',
    status: STORY_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now
  });

  return collection.findOne({ _id: result.insertedId });
};

export const attachArticleToStory = async ({ storyId, article }) => {
  const collection = await getCollection();
  const now = new Date();
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : now;

  const result = await collection.findOneAndUpdate(
    { _id: toObjectId(storyId) },
    {
      $addToSet: {
        itemIds: toObjectId(article.sourceItemId),
        sourceIds: toObjectId(article.sourceId)
      },
      $max: {
        lastArticlePublishedAt: publishedAt
      },
      $set: {
        lastSeenAt: now,
        updatedAt: now
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return null;
  }

  const articleCount = Array.isArray(result.itemIds) ? result.itemIds.length : 0;
  const sourceCount = Array.isArray(result.sourceIds) ? result.sourceIds.length : 0;

  return collection.findOneAndUpdate(
    { _id: result._id },
    {
      $set: {
        articleCount,
        sourceCount,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
};

export const listActiveStories = async ({ limit = 50 } = {}) => {
  const collection = await getCollection();
  const query = { status: STORY_STATUS.ACTIVE };
  const maxAgeDays = Number(env.STORY_MAX_AGE_DAYS ?? 0);

  if (maxAgeDays > 0) {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    query.updatedAt = { $gte: cutoff };
  }

  return collection
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
};

export const listSingletonStories = async ({ limit = 200, since } = {}) => {
  const collection = await getCollection();
  const match = { status: STORY_STATUS.ACTIVE };

  if (since) {
    match.updatedAt = { $gte: new Date(since) };
  }

  return collection
    .aggregate([
      { $match: match },
      {
        $addFields: {
          computedItemCount: { $size: { $ifNull: ['$itemIds', []] } }
        }
      },
      {
        $match: {
          computedItemCount: { $lte: 1 }
        }
      },
      { $sort: { updatedAt: -1 } },
      { $limit: limit }
    ])
    .toArray();
};

export const mergeStoryIntoTarget = async ({ sourceStoryId, targetStoryId }) => {
  const collection = await getCollection();
  const now = new Date();

  const sourceId = toObjectId(sourceStoryId);
  const targetId = toObjectId(targetStoryId);

  const sourceStory = await collection.findOne({ _id: sourceId, status: STORY_STATUS.ACTIVE });
  if (!sourceStory) {
    return { merged: false, reason: 'source_story_not_found_or_inactive' };
  }

  if (String(sourceId) === String(targetId)) {
    return { merged: false, reason: 'same_story' };
  }

  const targetResult = await collection.findOneAndUpdate(
    { _id: targetId, status: STORY_STATUS.ACTIVE },
    {
      $addToSet: {
        itemIds: { $each: sourceStory.itemIds ?? [] },
        sourceIds: { $each: sourceStory.sourceIds ?? [] }
      },
      $max: {
        lastArticlePublishedAt: sourceStory.lastArticlePublishedAt ?? sourceStory.updatedAt ?? now
      },
      $set: {
        lastSeenAt: now,
        updatedAt: now
      }
    },
    { returnDocument: 'after' }
  );

  if (!targetResult) {
    return { merged: false, reason: 'target_story_not_found_or_inactive' };
  }

  const articleCount = Array.isArray(targetResult.itemIds) ? targetResult.itemIds.length : 0;
  const sourceCount = Array.isArray(targetResult.sourceIds) ? targetResult.sourceIds.length : 0;

  const updatedTarget = await collection.findOneAndUpdate(
    { _id: targetId },
    {
      $set: {
        articleCount,
        sourceCount,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  await collection.updateOne(
    { _id: sourceId },
    {
      $set: {
        status: STORY_STATUS.ARCHIVED,
        mergedIntoStoryId: targetId,
        mergedAt: now,
        updatedAt: now
      }
    }
  );

  return {
    merged: true,
    sourceStoryId: String(sourceId),
    targetStoryId: String(targetId),
    targetStory: updatedTarget
  };
};
