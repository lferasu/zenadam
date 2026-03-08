import { generateStoriesFromNormalizedItems } from './storyService.js';
import { normalizePendingSourceItems } from './normalizationService.js';
import { ingestActiveSources } from './sourceIngestionService.js';

export const runBackendSlicePipeline = async () => {
  const ingestion = await ingestActiveSources();
  const normalization = await normalizePendingSourceItems();
  const clustering = await generateStoriesFromNormalizedItems();

  return {
    ingestion,
    normalization,
    clustering
  };
};
