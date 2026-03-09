import { findItemsByIngestStatus, markSourceItemNormalized } from '../repositories/sourceItemRepository.js';
import { upsertNormalizedItem } from '../repositories/normalizedItemRepository.js';
import { SOURCE_ITEM_INGEST_STATUS } from '../models/SourceItem.js';
import { buildDedupeHash } from '../utils/hash.js';
import { normalizeText, pickKeywords } from '../utils/text.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

export const detectLanguage = (text = '') => {
  const amharicRegex = /[\u1200-\u137F]/;
  if (amharicRegex.test(text)) {
    return 'am';
  }

  return 'en';
};

const normalizeSourceItem = (item) => {
  const normalizedTitle = normalizeText(item.title || '');
  const normalizedContent = normalizeText(item.rawText || item.title || '');
  const snippet = normalizedContent.slice(0, 280) || normalizedTitle;
  const publishedAt = item.publishedAt ?? item.fetchedAt ?? null;
  const language = detectLanguage(`${normalizedTitle} ${normalizedContent}`);

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
