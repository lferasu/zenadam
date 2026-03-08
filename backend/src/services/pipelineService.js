import { generateStoriesFromNormalizedItems } from './storyService.js';
import { normalizePendingSourceItems } from './normalizationService.js';
import { ensureDefaultSources } from './sourceService.js';
import { ingestActiveRssSources } from './sourceIngestionService.js';

export const runBackendSlicePipeline = async () => {
  const sourceSeed = await ensureDefaultSources();
  const ingestion = await ingestActiveRssSources();
  const normalization = await normalizePendingSourceItems();
  const clustering = await generateStoriesFromNormalizedItems();

  return {
    sourceSeed,
    ingestion,
    normalization,
    clustering
  };
};
