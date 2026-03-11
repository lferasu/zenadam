import { env } from '../config/env.js';
import {
  findPendingNormalizationSourceItems,
  markSourceItemNormalizationFailed,
  markSourceItemNormalizationProcessing,
  markSourceItemNormalizationReady
} from '../repositories/sourceItemRepository.js';
import { upsertNormalizedItem } from '../repositories/normalizedItemRepository.js';
import { buildSourceItemEnrichment } from './sourceItemEnrichmentService.js';
import { ensureRuntimeInitialized } from './runtimeService.js';
import { runWithConcurrency } from '../utils/async.js';

export const normalizePendingSourceItems = async ({
  limit = env.ZENADAM_NORMALIZATION_BATCH_LIMIT,
  deps = {},
  skipRuntimeInitialization = false,
  concurrency = env.ZENADAM_NORMALIZATION_CONCURRENCY
} = {}) => {
  if (!skipRuntimeInitialization) {
    await ensureRuntimeInitialized();
  }

  if (!env.ZENADAM_ENABLE_NORMALIZATION) {
    return {
      scanned: 0,
      normalizedCount: 0,
      failedCount: 0,
      skipped: true,
      reason: 'normalization_disabled'
    };
  }

  const repository = {
    findPendingNormalizationSourceItems: deps.findPendingNormalizationSourceItems ?? findPendingNormalizationSourceItems,
    markSourceItemNormalizationProcessing: deps.markSourceItemNormalizationProcessing ?? markSourceItemNormalizationProcessing,
    markSourceItemNormalizationReady: deps.markSourceItemNormalizationReady ?? markSourceItemNormalizationReady,
    markSourceItemNormalizationFailed: deps.markSourceItemNormalizationFailed ?? markSourceItemNormalizationFailed,
    upsertNormalizedItem: deps.upsertNormalizedItem ?? upsertNormalizedItem
  };

  const enrichSourceItem = deps.enrichSourceItem ?? buildSourceItemEnrichment;

  const sourceItems = await repository.findPendingNormalizationSourceItems(limit);
  let normalizedCount = 0;
  let failedCount = 0;

  await runWithConcurrency({
    items: sourceItems,
    concurrency,
    worker: async (sourceItem) => {
      try {
        await repository.markSourceItemNormalizationProcessing(sourceItem._id);
        const enriched = await enrichSourceItem(sourceItem, { targetLanguage: env.ZENADAM_TARGET_LANGUAGE });

        await repository.upsertNormalizedItem(enriched.normalizedItem);

        await repository.markSourceItemNormalizationReady(sourceItem._id, {
          sourceLanguage: enriched.sourceLanguage,
          targetLanguage: enriched.targetLanguage,
          normalizedTitle: enriched.normalizedItem.normalizedTitle,
          normalizedDetailedSummary: enriched.normalizedItem.normalizedDetailedSummary,
          normalizedDetailedSummaryStructured: enriched.normalizedItem.structuredSummary,
          snippet: enriched.normalizedItem.snippet,
          enrichmentMetadata: {
            ...(enriched.normalizedItem.enrichmentMetadata ?? {}),
            embeddingCreatedAt: enriched.normalizedItem.embeddingCreatedAt ?? null
          }
        });

        normalizedCount += 1;
      } catch (error) {
        failedCount += 1;
        await repository.markSourceItemNormalizationFailed(sourceItem._id, error.message, {
          targetLanguage: env.ZENADAM_TARGET_LANGUAGE,
          enrichmentStatus: 'failed'
        });
      }
    }
  });

  return {
    scanned: sourceItems.length,
    normalizedCount,
    failedCount
  };
};
