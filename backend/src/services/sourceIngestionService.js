import { logger } from '../config/logger.js';
import { SOURCE_TYPES } from '../models/Source.js';
import { getIngestorForSourceType } from '../ingestion/ingestorRegistry.js';
import { findActiveSourcesByType } from '../repositories/sourceRepository.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

const createRunMetrics = () => ({
  totalSourcesProcessed: 0,
  sourcesSucceeded: 0,
  sourcesFailed: 0,
  feedsSucceeded: 0,
  feedsFailed: 0,
  itemsFetched: 0,
  itemsInserted: 0,
  itemsSkipped: 0
});

const aggregateMetrics = (metrics, sourceResult) => {
  metrics.totalSourcesProcessed += 1;

  if (sourceResult.status === 'failed') {
    metrics.sourcesFailed += 1;
  } else {
    metrics.sourcesSucceeded += 1;
  }

  metrics.feedsSucceeded += Number(sourceResult?.totals?.feedsSucceeded ?? 0);
  metrics.feedsFailed += Number(sourceResult?.totals?.feedsFailed ?? 0);
  metrics.itemsFetched += Number(sourceResult?.totals?.itemsFetched ?? 0);
  metrics.itemsInserted += Number(sourceResult?.totals?.itemsInserted ?? 0);
  metrics.itemsSkipped += Number(sourceResult?.totals?.itemsSkipped ?? 0);
};

export const ingestSource = async (source) => {
  const ingestor = getIngestorForSourceType(source.type);

  if (!ingestor) {
    return {
      sourceId: source._id,
      sourceSlug: source.slug,
      sourceType: source.type,
      status: 'failed',
      error: `Unsupported source type: ${source.type}`
    };
  }

  try {
    return await ingestor.ingest(source);
  } catch (error) {
    return {
      sourceId: source._id,
      sourceSlug: source.slug,
      sourceType: source.type,
      status: 'failed',
      error: error.message
    };
  }
};

export const ingestActiveSources = async ({ sourceType } = {}) => {
  await ensureRuntimeInitialized();

  const activeSources = await findActiveSourcesByType(sourceType);
  const metrics = createRunMetrics();
  const results = [];

  for (const source of activeSources) {
    const sourceResult = await ingestSource(source);

    if (sourceResult.status === 'failed') {
      logger.warn('Source ingestion failed', {
        sourceId: source._id,
        sourceSlug: source.slug,
        sourceType: source.type,
        error: sourceResult.error
      });
    }

    aggregateMetrics(metrics, sourceResult);
    results.push(sourceResult);
  }

  logger.info('Ingestion run completed', metrics);

  return {
    metrics,
    results
  };
};

export const ingestActiveRssSources = async () => {
  return ingestActiveSources({ sourceType: SOURCE_TYPES.RSS });
};
