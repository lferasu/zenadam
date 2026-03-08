import { findItemsByIngestStatus, markSourceItemNormalized } from '../repositories/sourceItemRepository.js';
import { upsertNormalizedItem } from '../repositories/normalizedItemRepository.js';
import { SOURCE_ITEM_INGEST_STATUS } from '../models/SourceItem.js';
import { buildDedupeHash } from '../utils/hash.js';
import { normalizeText, pickKeywords } from '../utils/text.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

const normalizeSourceItem = (item) => {
  const normalizedTitle = normalizeText(item.title || '');
  const normalizedContent = normalizeText(item.rawText || item.title || '');
  const publishedAt = item.publishedAt ?? item.fetchedAt ?? null;

  return {
    sourceItemId: item._id,
    sourceId: item.sourceId,
    canonicalUrl: item.url ?? null,
    title: normalizedTitle,
    content: normalizedContent,
    language: 'am',
    entities: [],
    keywords: pickKeywords(normalizedTitle, normalizedContent),
    publishedAt,
    dedupeHash: buildDedupeHash({
      title: normalizedTitle,
      content: normalizedContent,
      publishedAt
    })
  };
};

export const normalizePendingSourceItems = async ({ limit = 100 } = {}) => {
  await ensureRuntimeInitialized();

  const sourceItems = await findItemsByIngestStatus(SOURCE_ITEM_INGEST_STATUS.FETCHED, limit);
  let normalizedCount = 0;

  for (const sourceItem of sourceItems) {
    const normalized = normalizeSourceItem(sourceItem);
    await upsertNormalizedItem(normalized);
    await markSourceItemNormalized(sourceItem._id);
    normalizedCount += 1;
  }

  return {
    scanned: sourceItems.length,
    normalizedCount
  };
};
