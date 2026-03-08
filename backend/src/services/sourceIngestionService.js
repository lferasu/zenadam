import { ingestRssSource } from '../ingestion/rss/rssIngestor.js';
import { SOURCE_TYPES } from '../models/Source.js';
import { findActiveSourcesByType } from '../repositories/sourceRepository.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

export const ingestActiveSources = async ({ sourceType } = {}) => {
  await ensureRuntimeInitialized();

  const activeSources = await findActiveSourcesByType(sourceType);
  const results = [];

  for (const source of activeSources) {
    if (source.type === SOURCE_TYPES.RSS) {
      const ingestResults = await ingestRssSource(source);
      results.push({
        sourceId: source._id,
        sourceSlug: source.slug,
        type: source.type,
        ingestResults
      });
    }
  }

  return results;
};

export const ingestActiveRssSources = async () => {
  return ingestActiveSources({ sourceType: SOURCE_TYPES.RSS });
};
