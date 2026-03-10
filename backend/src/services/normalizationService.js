import { env } from '../config/env.js';
import { generateSourceItemNormalization } from '../ai/index.js';
import {
  findPendingNormalizationSourceItems,
  markSourceItemNormalizationFailed,
  markSourceItemNormalizationProcessing,
  markSourceItemNormalizationReady
} from '../repositories/sourceItemRepository.js';
import { upsertNormalizedItem } from '../repositories/normalizedItemRepository.js';
import { buildDedupeHash } from '../utils/hash.js';
import { normalizeText, pickKeywords } from '../utils/text.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

const buildNormalizedRecord = (item, language) => {
  const normalizedTitle = normalizeText(item.title || '');
  const normalizedContent = normalizeText(item.rawText || item.title || '');
  const snippet = normalizedContent.slice(0, 280) || normalizedTitle;
  const publishedAt = item.publishedAt ?? item.fetchedAt ?? null;

  return {
    sourceItemId: item._id,
    sourceId: item.sourceId,
    canonicalUrl: item.url ?? null,
    title: normalizedTitle,
    snippet,
    content: normalizedContent,
    language,
    entities: [],
    keywords: pickKeywords(normalizedTitle, normalizedContent),
    publishedAt,
    clusteringStatus: 'pending',
    dedupeHash: buildDedupeHash({
      title: normalizedTitle,
      content: normalizedContent,
      publishedAt
    })
  };
};

export const normalizePendingSourceItems = async ({ limit = env.ZENADAM_NORMALIZATION_BATCH_LIMIT } = {}) => {
  await ensureRuntimeInitialized();

  if (!env.ZENADAM_ENABLE_NORMALIZATION) {
    return {
      scanned: 0,
      normalizedCount: 0,
      skipped: true,
      reason: 'normalization_disabled'
    };
  }

  const sourceItems = await findPendingNormalizationSourceItems(limit);
  let normalizedCount = 0;
  let failedCount = 0;

  for (const sourceItem of sourceItems) {
    try {
      await markSourceItemNormalizationProcessing(sourceItem._id);
      const targetLanguage = env.ZENADAM_TARGET_LANGUAGE;
      const normalization = await generateSourceItemNormalization({
        title: sourceItem.title || '',
        body: sourceItem.rawText || '',
        targetLanguage
      });

      const normalized = buildNormalizedRecord(sourceItem, normalization.sourceLanguage);
      await upsertNormalizedItem(normalized);

      await markSourceItemNormalizationReady(sourceItem._id, {
        sourceLanguage: normalization.sourceLanguage,
        targetLanguage,
        normalizedTitle: normalization.normalizedTitle,
        normalizedDetailedSummary: normalization.normalizedDetailedSummary
      });

      normalizedCount += 1;
    } catch (error) {
      failedCount += 1;
      await markSourceItemNormalizationFailed(sourceItem._id, error.message);
    }
  }

  return {
    scanned: sourceItems.length,
    normalizedCount,
    failedCount
  };
};
