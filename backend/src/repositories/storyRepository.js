import { ObjectId } from 'mongodb';
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

  return collection
    .find({ status: STORY_STATUS.ACTIVE })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
};
