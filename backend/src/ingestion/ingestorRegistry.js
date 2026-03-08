import { SOURCE_TYPES } from '../models/Source.js';
import { ingestApiSource } from './api/index.js';
import { ingestRssSource } from './rss/rssIngestor.js';
import { ingestScraperSource } from './scraper/index.js';

const INGESTORS = {
  [SOURCE_TYPES.RSS]: {
    type: SOURCE_TYPES.RSS,
    ingest: ingestRssSource
  },
  [SOURCE_TYPES.SCRAPER]: {
    type: SOURCE_TYPES.SCRAPER,
    ingest: ingestScraperSource
  },
  [SOURCE_TYPES.API]: {
    type: SOURCE_TYPES.API,
    ingest: ingestApiSource
  }
};

export const getIngestorForSourceType = (sourceType) => {
  return INGESTORS[sourceType] ?? null;
};

export const listSupportedIngestorTypes = () => {
  return Object.keys(INGESTORS);
};
