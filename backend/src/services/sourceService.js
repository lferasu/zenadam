import { SOURCE_STATUS, SOURCE_TYPES } from '../models/Source.js';
import { findSourceBySlug, upsertSourceBySlug } from '../repositories/sourceRepository.js';
import { ensureRuntimeInitialized } from './runtimeService.js';

const BBC_AMHARIC_SOURCE = {
  name: 'BBC Amharic',
  slug: 'bbc-amharic',
  type: SOURCE_TYPES.RSS,
  status: SOURCE_STATUS.ACTIVE,
  language: 'am',
  baseUrl: 'https://www.bbc.com/amharic',
  entryUrls: [
    'https://feeds.bbci.co.uk/amharic/rss.xml'
  ],
  fetchConfig: {
    timeoutMs: 15000,
    userAgent: 'ZenadamBot/0.1 (+https://zenadam.local)'
  },
  parserConfig: {
    format: 'rss',
    preferContentEncoded: true
  },
  normalizationConfig: {
    stripBoilerplate: true,
    collapseWhitespace: true
  }
};

export const ensureDefaultSources = async () => {
  await ensureRuntimeInitialized();

  const existing = await findSourceBySlug(BBC_AMHARIC_SOURCE.slug);
  if (existing) {
    return { created: false, source: existing };
  }

  const source = await upsertSourceBySlug(BBC_AMHARIC_SOURCE);
  return { created: true, source };
};
