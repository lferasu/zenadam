import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';
import { getDb } from '../config/database.js';
import { NORMALIZED_ITEM_COLLECTION } from '../models/NormalizedItem.js';
import { SOURCE_COLLECTION } from '../models/Source.js';
import { STORY_COLLECTION, STORY_STATUS, STORY_SUMMARY_STATUS } from '../models/Story.js';
import { mergeTopicSignatures } from '../utils/topicFingerprint.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(STORY_COLLECTION);
};

const toObjectId = (value) => (value instanceof ObjectId ? value : new ObjectId(value));
const mergeStoryTopicSignature = (current, incoming) => mergeTopicSignatures(current, incoming);
const toPersistedRanking = (ranking) => {
  if (!ranking) {
    return null;
  }

  return {
    storyScore: Number(ranking.storyScore ?? 0),
    sortLatestAt: ranking.sortLatestAt ? new Date(ranking.sortLatestAt) : new Date(),
    signals: {
      recencyScore: Number(ranking.signals?.recencyScore ?? 0),
      sourceRankScore: Number(ranking.signals?.sourceRankScore ?? 0),
      popularityScore: Number(ranking.signals?.popularityScore ?? 0),
      diversityScore: Number(ranking.signals?.diversityScore ?? 0),
      velocityScore: Number(ranking.signals?.velocityScore ?? 0)
    },
    strategyVersion: ranking.strategyVersion ?? 'story-ranking-v1',
    lastRankedAt: ranking.lastRankedAt ? new Date(ranking.lastRankedAt) : new Date()
  };
};
const toPersistedHeroImage = (heroImage) => {
  if (!heroImage?.url) {
    return null;
  }

  return {
    url: heroImage.url,
    sourceItemId: heroImage.sourceItemId ? toObjectId(heroImage.sourceItemId) : null,
    selectionReason: heroImage.selectionReason ?? 'first_valid',
    ...(heroImage.width ? { width: heroImage.width } : {}),
    ...(heroImage.height ? { height: heroImage.height } : {}),
    updatedAt: heroImage.updatedAt ? new Date(heroImage.updatedAt) : new Date()
  };
};

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
        ...(story.heroImage ? { heroImage: toPersistedHeroImage(story.heroImage) } : {}),
        ...(story.ranking ? { ranking: toPersistedRanking(story.ranking) } : {}),
        status: story.status ?? STORY_STATUS.ACTIVE,
        targetLanguage: story.targetLanguage ?? env.ZENADAM_TARGET_LANGUAGE,
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
  const normalizedItemId = article._id ? toObjectId(article._id) : toObjectId(article.sourceItemId);
  const heroArticleId = normalizedItemId;

  const result = await collection.insertOne({
    title: article.title,
    summary: article.snippet ?? null,
    topicSignature: article.topicFingerprint ?? null,
    heroArticleId,
    itemIds: [normalizedItemId],
    sourceIds: [sourceId],
    articleCount: 1,
    sourceCount: 1,
    firstSeenAt: publishedAt,
    lastSeenAt: now,
    lastArticlePublishedAt: publishedAt,
    language: article.language ?? 'en',
    targetLanguage: env.ZENADAM_TARGET_LANGUAGE,
    storySummaryStatus: STORY_SUMMARY_STATUS.PENDING,
    storySummaryError: null,
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
  const normalizedItemId = article._id ? toObjectId(article._id) : toObjectId(article.sourceItemId);
  const existingStory = await collection.findOne({ _id: toObjectId(storyId) }, { projection: { topicSignature: 1 } });

  const result = await collection.findOneAndUpdate(
    { _id: toObjectId(storyId) },
    {
      $addToSet: {
        itemIds: normalizedItemId,
        sourceIds: toObjectId(article.sourceId)
      },
      $max: {
        lastArticlePublishedAt: publishedAt
      },
      $set: {
        lastSeenAt: now,
        storySummaryStatus: STORY_SUMMARY_STATUS.STALE,
        storySummaryError: null,
        topicSignature: mergeStoryTopicSignature(existingStory?.topicSignature, article.topicFingerprint),
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

export const updateStorySummaryProcessing = async ({ storyId, targetLanguage = env.ZENADAM_TARGET_LANGUAGE }) => {
  const collection = await getCollection();

  return collection.updateOne(
    { _id: toObjectId(storyId) },
    {
      $set: {
        targetLanguage,
        storySummaryStatus: STORY_SUMMARY_STATUS.PROCESSING,
        storySummaryError: null,
        updatedAt: new Date()
      }
    }
  );
};

export const updateStorySummaryReady = async ({ storyId, storyTitle, storySummary, targetLanguage = env.ZENADAM_TARGET_LANGUAGE }) => {
  const collection = await getCollection();
  const now = new Date();

  return collection.updateOne(
    { _id: toObjectId(storyId) },
    {
      $set: {
        title: storyTitle,
        summary: storySummary,
        storyTitle,
        storySummary,
        targetLanguage,
        storySummaryStatus: STORY_SUMMARY_STATUS.READY,
        storySummaryError: null,
        storySummaryUpdatedAt: now,
        updatedAt: now
      }
    }
  );
};

export const updateStorySummaryFailed = async ({ storyId, error }) => {
  const collection = await getCollection();

  return collection.updateOne(
    { _id: toObjectId(storyId) },
    {
      $set: {
        storySummaryStatus: STORY_SUMMARY_STATUS.FAILED,
        storySummaryError: error,
        storySummaryUpdatedAt: new Date(),
        updatedAt: new Date()
      }
    }
  );
};

export const updateStoryHeroImage = async ({ storyId, heroImage }) => {
  const collection = await getCollection();

  if (!heroImage?.url) {
    return collection.updateOne(
      { _id: toObjectId(storyId) },
      {
        $unset: { heroImage: '' },
        $set: { updatedAt: new Date() }
      }
    );
  }

  return collection.updateOne(
    { _id: toObjectId(storyId) },
    {
      $set: {
        heroImage: toPersistedHeroImage(heroImage),
        updatedAt: new Date()
      }
    }
  );
};

export const updateStoryRanking = async ({ storyId, ranking }) => {
  const collection = await getCollection();

  if (!ranking) {
    return collection.updateOne(
      { _id: toObjectId(storyId) },
      {
        $unset: { ranking: '' },
        $set: { updatedAt: new Date() }
      }
    );
  }

  return collection.updateOne(
    { _id: toObjectId(storyId) },
    {
      $set: {
        ranking: toPersistedRanking(ranking),
        updatedAt: new Date()
      }
    }
  );
};

export const updateStoryPrimaryArticle = async ({ storyId, primaryArticleId }) => {
  const collection = await getCollection();

  if (!primaryArticleId) {
    return collection.updateOne(
      { _id: toObjectId(storyId) },
      {
        $unset: { heroArticleId: '' },
        $set: { updatedAt: new Date() }
      }
    );
  }

  return collection.updateOne(
    { _id: toObjectId(storyId) },
    {
      $set: {
        heroArticleId: toObjectId(primaryArticleId),
        updatedAt: new Date()
      }
    }
  );
};

export const listStoryArticlesForSummary = async ({ storyId, limit = 10 }) => {
  const db = await getDb();

  return db
    .collection(NORMALIZED_ITEM_COLLECTION)
    .find({ storyId: toObjectId(storyId) }, { projection: { title: 1, snippet: 1, content: 1, publishedAt: 1 } })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
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

const buildConsumerStorySort = (sort = 'relevant') => {
  if (sort === 'latest') {
    return { sortLatestAtComputed: -1, storyScoreComputed: -1, updatedAt: -1, _id: -1 };
  }

  return { storyScoreComputed: -1, sortLatestAtComputed: -1, updatedAt: -1, _id: -1 };
};

export const findStoryForRanking = async ({ storyId }) => {
  const collection = await getCollection();

  const [story] = await collection
    .aggregate([
      {
        $match: {
          _id: toObjectId(storyId)
        }
      },
      {
        $lookup: {
          from: NORMALIZED_ITEM_COLLECTION,
          let: { itemIds: '$itemIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$itemIds', []] }] } } },
            {
              $lookup: {
                from: SOURCE_COLLECTION,
                localField: 'sourceId',
                foreignField: '_id',
                as: 'source'
              }
            },
            {
              $project: {
                _id: 1,
                sourceId: 1,
                title: { $ifNull: ['$normalizedTitle', '$title'] },
                snippet: 1,
                normalizedDetailedSummary: 1,
                content: 1,
                publishedAt: 1,
                createdAt: 1,
                updatedAt: 1,
                clusteringScore: 1,
                clusteringMetadata: 1,
                source: { $arrayElemAt: ['$source', 0] }
              }
            }
          ],
          as: 'items'
        }
      },
      {
        $project: {
          _id: 1,
          itemIds: 1,
          sourceIds: 1,
          articleCount: 1,
          sourceCount: 1,
          lastArticlePublishedAt: 1,
          lastSeenAt: 1,
          updatedAt: 1,
          ranking: 1,
          items: 1
        }
      }
    ])
    .toArray();

  return story ?? null;
};

export const listStoriesForConsumer = async ({ limit = 25, skip = 0, sort = 'relevant' } = {}) => {
  const collection = await getCollection();

  return collection
    .aggregate([
      { $match: { status: STORY_STATUS.ACTIVE } },
      {
        $addFields: {
          sourceCountComputed: { $size: { $ifNull: ['$sourceIds', []] } },
          articleCountComputed: { $size: { $ifNull: ['$itemIds', []] } },
          latestPublishedAt: { $ifNull: ['$lastArticlePublishedAt', '$updatedAt'] },
          sortLatestAtComputed: { $ifNull: ['$ranking.sortLatestAt', { $ifNull: ['$lastArticlePublishedAt', '$updatedAt'] }] },
          storyScoreComputed: { $ifNull: ['$ranking.storyScore', 0] }
        }
      },
      { $sort: buildConsumerStorySort(sort) },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: NORMALIZED_ITEM_COLLECTION,
          let: { itemIds: '$itemIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$itemIds', []] }] } } },
            { $sort: { publishedAt: -1, createdAt: -1 } },
            { $limit: 3 },
            {
              $lookup: {
                from: SOURCE_COLLECTION,
                localField: 'sourceId',
                foreignField: '_id',
                as: 'source'
              }
            },
            {
              $project: {
                _id: 0,
                sourceName: {
                  $ifNull: [{ $arrayElemAt: ['$source.name', 0] }, { $arrayElemAt: ['$source.slug', 0] }]
                }
              }
            }
          ],
          as: 'sourcePreview'
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          summary: 1,
          storyTitle: 1,
          storySummary: 1,
          heroImage: 1,
          ranking: 1,
          sourceCount: '$sourceCountComputed',
          articleCount: '$articleCountComputed',
          latestPublishedAt: 1,
          updatedAt: 1,
          sourcePreview: 1
        }
      }
    ])
    .toArray();
};

export const findStoryForConsumerById = async ({ id }) => {
  const collection = await getCollection();

  const [story] = await collection
    .aggregate([
      {
        $match: {
          _id: toObjectId(id),
          status: STORY_STATUS.ACTIVE
        }
      },
      {
        $addFields: {
          sourceCountComputed: { $size: { $ifNull: ['$sourceIds', []] } },
          articleCountComputed: { $size: { $ifNull: ['$itemIds', []] } },
          latestPublishedAt: { $ifNull: ['$lastArticlePublishedAt', '$updatedAt'] }
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          summary: 1,
          storyTitle: 1,
          storySummary: 1,
          heroImage: 1,
          ranking: 1,
          sourceCount: '$sourceCountComputed',
          articleCount: '$articleCountComputed',
          latestPublishedAt: 1,
          updatedAt: 1
        }
      }
    ])
    .toArray();

  return story ?? null;
};

export const listConsumerStoryArticles = async ({ storyId }) => {
  const db = await getDb();

  return db
    .collection(NORMALIZED_ITEM_COLLECTION)
    .aggregate([
      {
        $match: {
          storyId: toObjectId(storyId)
        }
      },
      { $sort: { publishedAt: -1, createdAt: -1 } },
      {
        $lookup: {
          from: SOURCE_COLLECTION,
          localField: 'sourceId',
          foreignField: '_id',
          as: 'source'
        }
      },
      {
        $project: {
          _id: 1,
          storyId: 1,
          title: { $ifNull: ['$normalizedTitle', '$title'] },
          summary: { $ifNull: ['$normalizedDetailedSummary', '$content'] },
          snippet: 1,
          normalizedDetailedSummary: 1,
          content: 1,
          image: 1,
          canonicalUrl: 1,
          publishedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          targetLanguage: 1,
          clusteringScore: 1,
          clusteringMetadata: 1,
          source: { $arrayElemAt: ['$source', 0] },
          sourceName: {
            $ifNull: [{ $arrayElemAt: ['$source.name', 0] }, { $arrayElemAt: ['$source.slug', 0] }]
          }
        }
      }
    ])
    .toArray();
};

const buildStorySort = (sort) => {
  if (sort === 'created_asc') {
    return { createdAt: 1, _id: 1 };
  }

  if (sort === 'created_desc') {
    return { createdAt: -1, _id: -1 };
  }

  if (sort === 'article_count_desc') {
    return { articleCountComputed: -1, latestArticleAt: -1, _id: -1 };
  }

  return { latestArticleAt: -1, updatedAt: -1, _id: -1 };
};

export const listStoriesForInspection = async ({
  page = 1,
  limit = 25,
  sort = 'recent',
  hasSummary,
  minArticleCount
} = {}) => {
  const collection = await getCollection();
  const skip = (page - 1) * limit;

  const baseMatch = { status: STORY_STATUS.ACTIVE };

  if (hasSummary === true) {
    baseMatch.summary = { $type: 'string', $ne: '' };
  } else if (hasSummary === false) {
    baseMatch.$or = [{ summary: { $exists: false } }, { summary: null }, { summary: '' }];
  }

  const threshold = Number.isFinite(minArticleCount) ? Number(minArticleCount) : null;

  const pipeline = [
    { $match: baseMatch },
    {
      $addFields: {
        articleCountComputed: { $size: { $ifNull: ['$itemIds', []] } },
        latestArticleAt: {
          $ifNull: ['$lastArticlePublishedAt', '$updatedAt']
        }
      }
    }
  ];

  if (threshold !== null) {
    pipeline.push({
      $match: {
        articleCountComputed: { $gte: threshold }
      }
    });
  }

  pipeline.push(
    {
      $facet: {
        rows: [
          { $sort: buildStorySort(sort) },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: NORMALIZED_ITEM_COLLECTION,
              let: { itemIds: '$itemIds' },
              pipeline: [
                { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$itemIds', []] }] } } },
                { $sort: { publishedAt: -1, createdAt: -1 } },
                { $limit: 3 },
                {
                  $lookup: {
                    from: SOURCE_COLLECTION,
                    localField: 'sourceId',
                    foreignField: '_id',
                    as: 'source'
                  }
                },
                {
                  $project: {
                    _id: 0,
                    title: 1,
                    image: 1,
                    publishedAt: 1,
                    source: {
                      $ifNull: [{ $arrayElemAt: ['$source.name', 0] }, { $arrayElemAt: ['$source.slug', 0] }]
                    }
                  }
                }
              ],
              as: 'previewArticles'
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              summary: 1,
              storyTitle: 1,
              storySummary: 1,
              heroImage: 1,
              ranking: 1,
              createdAt: 1,
              updatedAt: 1,
              latestArticleAt: 1,
              articleCount: '$articleCountComputed',
              previewArticles: 1
            }
          }
        ],
        totalCount: [{ $count: 'value' }]
      }
    }
  );

  const [result] = await collection.aggregate(pipeline).toArray();
  const items = result?.rows ?? [];
  const total = result?.totalCount?.[0]?.value ?? 0;

  return {
    items,
    total,
    page,
    limit
  };
};

export const findStoryForInspectionById = async ({ id }) => {
  const collection = await getCollection();

  const [story] = await collection
    .aggregate([
      {
        $match: {
          _id: toObjectId(id),
          status: STORY_STATUS.ACTIVE
        }
      },
      {
        $addFields: {
          articleCountComputed: { $size: { $ifNull: ['$itemIds', []] } }
        }
      },
      {
        $lookup: {
          from: NORMALIZED_ITEM_COLLECTION,
          let: { itemIds: '$itemIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$itemIds', []] }] } } },
            { $sort: { publishedAt: -1, createdAt: -1 } },
            {
              $lookup: {
                from: SOURCE_COLLECTION,
                localField: 'sourceId',
                foreignField: '_id',
                as: 'source'
              }
            },
            {
              $project: {
                _id: 1,
                title: 1,
                image: 1,
                canonicalUrl: 1,
                publishedAt: 1,
                language: 1,
                createdAt: 1,
                sourceName: {
                  $ifNull: [{ $arrayElemAt: ['$source.name', 0] }, { $arrayElemAt: ['$source.slug', 0] }]
                },
                sourceType: { $arrayElemAt: ['$source.type', 0] },
                clusteringScore: 1,
                clusteringMetadata: 1
              }
            }
          ],
          as: 'articles'
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          summary: 1,
          storyTitle: 1,
          storySummary: 1,
          heroImage: 1,
          ranking: 1,
          createdAt: 1,
          updatedAt: 1,
          articleCount: '$articleCountComputed',
          heroArticleId: 1,
          articles: 1
        }
      }
    ])
    .toArray();

  return story ?? null;
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

  const targetStory = await collection.findOne({ _id: targetId, status: STORY_STATUS.ACTIVE }, { projection: { topicSignature: 1 } });

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
        storySummaryStatus: STORY_SUMMARY_STATUS.STALE,
        storySummaryError: null,
        topicSignature: mergeStoryTopicSignature(targetStory?.topicSignature, sourceStory.topicSignature),
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
