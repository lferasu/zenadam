import { ObjectId } from 'mongodb';
import { env } from '../src/config/env.js';
import { closeMongoClient, getDb } from '../src/config/database.js';
import { logger } from '../src/config/logger.js';
import { NORMALIZED_ITEM_COLLECTION } from '../src/models/NormalizedItem.js';
import { buildArticleEmbedding, generateEmbedding } from '../src/services/embeddingService.js';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const fromIdArg = args.find((arg) => arg.startsWith('--from-id='));

const batchSize = toInt(batchSizeArg?.split('=')[1], 50);
const limit = toInt(limitArg?.split('=')[1], 0);
const fromId = fromIdArg?.split('=')[1] ?? null;

const buildMissingEmbeddingQuery = (lastId) => {
  const clauses = [
    { embedding: { $exists: false } },
    { embedding: null },
    {
      $and: [{ embedding: { $type: 'array' } }, { embedding: { $size: 0 } }]
    }
  ];

  const query = { $or: clauses };

  if (lastId) {
    query._id = { $gt: new ObjectId(lastId) };
  }

  return query;
};

const run = async () => {
  if (!env.OPENAI_API_KEY && !dryRun) {
    throw new Error('OPENAI_API_KEY is required for embedding backfill (or run with --dry-run).');
  }

  const db = await getDb();
  const collection = db.collection(NORMALIZED_ITEM_COLLECTION);

  const stats = {
    scanned: 0,
    updated: 0,
    skippedNoText: 0,
    failed: 0,
    dryRun
  };

  let lastId = fromId;

  logger.info('Starting normalized_items embedding backfill', {
    dryRun,
    batchSize,
    limit: limit || 'none',
    fromId,
    embeddingModel: env.ZENADAM_EMBEDDING_MODEL
  });

  while (true) {
    if (limit && stats.scanned >= limit) {
      break;
    }

    const remaining = limit ? Math.max(limit - stats.scanned, 0) : batchSize;
    const currentBatchSize = limit ? Math.min(batchSize, remaining) : batchSize;

    if (!currentBatchSize) {
      break;
    }

    const query = buildMissingEmbeddingQuery(lastId);
    const docs = await collection
      .find(query, {
        projection: {
          title: 1,
          snippet: 1
        }
      })
      .sort({ _id: 1 })
      .limit(currentBatchSize)
      .toArray();

    if (!docs.length) {
      break;
    }

    for (const doc of docs) {
      stats.scanned += 1;
      lastId = String(doc._id);

      const embeddingText = buildArticleEmbedding(doc);
      if (!embeddingText) {
        stats.skippedNoText += 1;
        continue;
      }

      try {
        const embedding = dryRun ? [0] : await generateEmbedding(embeddingText);

        if (!embedding.length) {
          stats.skippedNoText += 1;
          continue;
        }

        if (!dryRun) {
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: {
                embedding,
                embeddingModel: env.ZENADAM_EMBEDDING_MODEL,
                embeddingCreatedAt: new Date(),
                updatedAt: new Date()
              }
            }
          );
        }

        stats.updated += 1;
      } catch (error) {
        stats.failed += 1;
        logger.error('Embedding backfill failed for normalized item', {
          normalizedItemId: String(doc._id),
          message: error.message
        });
      }
    }

    logger.info('Embedding backfill progress', {
      ...stats,
      lastProcessedId: lastId
    });
  }

  logger.info('Embedding backfill completed', {
    ...stats,
    lastProcessedId: lastId
  });
};

run()
  .catch((error) => {
    logger.error('Embedding backfill script failed', { message: error.message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
