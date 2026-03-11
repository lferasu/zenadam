import { env } from '../config/env.js';
import { generateSourceItemNormalization } from '../ai/index.js';
import {
  findPendingNormalizationSourceItems,
  markSourceItemNormalizationFailed,
  markSourceItemNormalizationProcessing,
  markSourceItemNormalizationReady
} from '../repositories/sourceItemRepository.js';
import { upsertNormalizedItem } from '../repositories/normalizedItemRepository.js';
import { extractTypedEntities, mergeTypedEntities } from './entityExtractionService.js';
import { buildDedupeHash } from '../utils/hash.js';
import { normalizeText, pickKeywords } from '../utils/text.js';
import { buildTopicFingerprint } from '../utils/topicFingerprint.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

const buildNormalizedRecord = (item, normalization, typedEntities) => {
  const normalizedTitle = normalizeText(item.title || '');
  const normalizedContent = normalizeText(item.rawText || item.title || '');
  const snippet = normalizedContent.slice(0, 280) || normalizedTitle;
  const publishedAt = item.publishedAt ?? item.fetchedAt ?? null;
  const topicFingerprint = buildTopicFingerprint({
    title: normalization.normalizedTitle,
    detailedSummary: normalization.normalizedDetailedSummary,
    structuredSummary: normalization.normalizedDetailedSummaryStructured,
    content: normalizedContent,
    snippet,
    typedEntities
  });

  return {
    sourceItemId: item._id,
    sourceId: item.sourceId,
    canonicalUrl: item.url ?? null,
    title: normalizedTitle,
    snippet,
    content: normalizedContent,
    normalizedDetailedSummary: normalization.normalizedDetailedSummary,
    normalizedDetailedSummaryStructured: normalization.normalizedDetailedSummaryStructured,
    language: normalization.sourceLanguage,
    entities: topicFingerprint.entities,
    persons: topicFingerprint.persons,
    locations: topicFingerprint.locations,
    keywords: uniqueKeywords(topicFingerprint.keywords, normalizedTitle, normalizedContent),
    topicFingerprint,
    publishedAt,
    clusteringStatus: 'pending',
    dedupeHash: buildDedupeHash({
      title: normalizedTitle,
      content: normalizedContent,
      publishedAt
    })
  };
};

const uniqueKeywords = (fingerprintKeywords, title, content) => {
  return [...new Set([...(fingerprintKeywords ?? []), ...pickKeywords(title, content)])].slice(0, 8);
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
        url: sourceItem.url || '',
        targetLanguage
      });

      const typedEntities = mergeTypedEntities(
        await extractTypedEntities({
          text: [normalization.normalizedTitle, normalization.normalizedDetailedSummary].filter(Boolean).join('\n\n'),
          language: normalization.sourceLanguage
        }),
        await extractTypedEntities({
          text: [sourceItem.title || '', sourceItem.rawText || ''].filter(Boolean).join('\n\n'),
          language: normalization.sourceLanguage
        })
      );

      const normalized = buildNormalizedRecord(sourceItem, normalization, typedEntities);
      await upsertNormalizedItem(normalized);

      await markSourceItemNormalizationReady(sourceItem._id, {
        sourceLanguage: normalization.sourceLanguage,
        targetLanguage,
        normalizedTitle: normalization.normalizedTitle,
        normalizedDetailedSummary: normalization.normalizedDetailedSummary,
        normalizedDetailedSummaryStructured: normalization.normalizedDetailedSummaryStructured
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
