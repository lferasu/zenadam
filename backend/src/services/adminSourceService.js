import { ObjectId } from 'mongodb';
import { SOURCE_STATUS, SOURCE_TYPES } from '../models/Source.js';
import {
  createSource,
  findSourceByBaseUrl,
  findSourceByEntryUrl,
  findSourceById,
  findSourceBySlug,
  listSources,
  updateSourceById
} from '../repositories/sourceRepository.js';
import { detectLanguage } from './languageDetectionService.js';
import { fetchFeedXml, parseFeedItems } from '../ingestion/rss/rssIngestor.js';

const DEFAULT_FETCH_CONFIG = {
  timeoutMs: 15000,
  retries: 2,
  retryDelayMs: 300,
  userAgent: 'ZenadamBot/0.1 (+https://zenadam.local)'
};

const DEFAULT_NORMALIZATION_CONFIG = {
  stripHtml: true,
  summaryMaxLength: 800,
  titleCleanupRules: []
};

const normalizeUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  return parsed.toString();
};

const normalizeSlug = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const normalizeSourceType = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return Object.values(SOURCE_TYPES).includes(normalized) ? normalized : null;
};

const normalizeLanguage = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return value.trim().toLowerCase();
};

const mapStatus = (isActive) => (isActive === false ? SOURCE_STATUS.INACTIVE : SOURCE_STATUS.ACTIVE);

const buildSourceRecord = (input, existing = {}) => {
  const type = normalizeSourceType(input.type ?? existing.type);
  const slug = normalizeSlug(input.slug ?? existing.slug);
  const name = (input.name ?? existing.name ?? '').trim();
  const baseUrl = normalizeUrl(input.baseUrl ?? existing.baseUrl ?? null);
  const language = normalizeLanguage(input.language ?? existing.language ?? null);
  const feedUrlInput = input.feedUrl ?? input.entryUrl ?? existing.feedUrl ?? existing.entryUrls?.[0] ?? null;
  const feedUrl = feedUrlInput ? normalizeUrl(feedUrlInput) : null;
  const status = mapStatus(input.isActive ?? (existing.status !== SOURCE_STATUS.INACTIVE));
  const typeRequiresFeed = type === SOURCE_TYPES.RSS || type === SOURCE_TYPES.API;
  const entryUrls = typeRequiresFeed ? (feedUrl ? [feedUrl] : []) : existing.entryUrls ?? [];

  return {
    ...existing,
    slug,
    name,
    type,
    baseUrl,
    entryUrls,
    language,
    status,
    fetchConfig: existing.fetchConfig ?? DEFAULT_FETCH_CONFIG,
    normalizationConfig: existing.normalizationConfig ?? DEFAULT_NORMALIZATION_CONFIG,
    parserConfig: existing.parserConfig ?? {}
  };
};

const mapAdminSource = (source) => ({
  id: String(source._id),
  slug: source.slug,
  name: source.name,
  type: source.type,
  baseUrl: source.baseUrl ?? null,
  feedUrl: source.entryUrls?.[0] ?? null,
  language: source.language ?? null,
  isActive: source.status === SOURCE_STATUS.ACTIVE,
  validationStatus: source.validationStatus ?? null,
  lastValidatedAt: source.lastValidatedAt?.toISOString?.() ?? null,
  lastValidationMessage: source.lastValidationMessage ?? null,
  createdAt: source.createdAt?.toISOString?.() ?? null,
  updatedAt: source.updatedAt?.toISOString?.() ?? null
});

const createValidationError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
};

const ensureObjectId = (id) => {
  if (!ObjectId.isValid(id)) {
    const error = new Error('Invalid source id');
    error.code = 'INVALID_SOURCE_ID';
    error.statusCode = 400;
    throw error;
  }
};

const validateRequiredFields = (candidate) => {
  const issues = [];

  if (!candidate.slug) {
    issues.push('slug is required');
  }

  if (!candidate.name) {
    issues.push('name is required');
  }

  if (!candidate.type) {
    issues.push('type must be one of rss, scraper, api');
  }

  if ((candidate.type === SOURCE_TYPES.RSS || candidate.type === SOURCE_TYPES.API) && candidate.entryUrls.length === 0) {
    issues.push('feedUrl is required for rss/api sources');
  }

  if (candidate.type === SOURCE_TYPES.SCRAPER && !candidate.baseUrl) {
    issues.push('baseUrl is required for scraper sources');
  }

  return issues;
};

const validateRssCandidate = async (candidate, deps) => {
  const issues = [];
  const warnings = [];
  let sampleCount = 0;
  let detectedLanguage = candidate.language ?? null;

  try {
    const fetchResult = await deps.fetchFeedXml(candidate.entryUrls[0], candidate.fetchConfig);
    const entries = parseFeedItems(fetchResult.xml ?? '');
    sampleCount = entries.length;

    if (!entries.length) {
      issues.push('RSS feed parsed successfully but no items were found');
    } else if (!detectedLanguage) {
      const sampleText = entries
        .slice(0, 3)
        .map((entry) => `${entry?.title ?? ''} ${entry?.description ?? ''}`.trim())
        .join(' ');
      detectedLanguage = deps.detectLanguage(sampleText);
    }
  } catch (error) {
    issues.push(error.message);
  }

  return {
    isValid: issues.length === 0,
    normalizedType: SOURCE_TYPES.RSS,
    detectedLanguage,
    sampleCount,
    issues,
    warnings,
    validatedAt: new Date().toISOString()
  };
};

const validateScraperCandidate = async (candidate, deps) => {
  const issues = [];
  const warnings = ['Scraper ingestion is not implemented yet; validation only checks fetchability and HTML readability.'];
  let detectedLanguage = candidate.language ?? null;
  let sampleCount = 0;

  try {
    const response = await deps.fetch(candidate.baseUrl, {
      headers: {
        'user-agent': candidate.fetchConfig?.userAgent ?? DEFAULT_FETCH_CONFIG.userAgent
      },
      signal: AbortSignal.timeout(candidate.fetchConfig?.timeoutMs ?? DEFAULT_FETCH_CONFIG.timeoutMs)
    });

    if (!response.ok) {
      issues.push(`Scraper fetch failed (${response.status}) for ${candidate.baseUrl}`);
    } else {
      const html = await response.text();
      sampleCount = html.length;
      const contentType = response.headers.get('content-type') ?? '';
      const looksHtml = contentType.includes('text/html') || /<html|<body|<article/i.test(html);

      if (!looksHtml) {
        issues.push('Fetched page does not appear to be readable HTML');
      } else if (!detectedLanguage) {
        const textSample = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000);
        detectedLanguage = deps.detectLanguage(textSample);
      }
    }
  } catch (error) {
    issues.push(error.message);
  }

  return {
    isValid: issues.length === 0,
    normalizedType: SOURCE_TYPES.SCRAPER,
    detectedLanguage,
    sampleCount,
    issues,
    warnings,
    validatedAt: new Date().toISOString()
  };
};

export const createAdminSourceService = (deps = {}) => {
  const resolvedDeps = {
    createSource: deps.createSource ?? createSource,
    fetch: deps.fetch ?? fetch,
    fetchFeedXml: deps.fetchFeedXml ?? fetchFeedXml,
    detectLanguage: deps.detectLanguage ?? detectLanguage,
    findSourceByBaseUrl: deps.findSourceByBaseUrl ?? findSourceByBaseUrl,
    findSourceByEntryUrl: deps.findSourceByEntryUrl ?? findSourceByEntryUrl,
    findSourceById: deps.findSourceById ?? findSourceById,
    findSourceBySlug: deps.findSourceBySlug ?? findSourceBySlug,
    listSources: deps.listSources ?? listSources,
    updateSourceById: deps.updateSourceById ?? updateSourceById
  };

  const validateCandidateSource = async (input, existing = {}) => {
    let candidate;

    try {
      candidate = buildSourceRecord(input, existing);
    } catch (error) {
      return {
        isValid: false,
        normalizedType: normalizeSourceType(input.type ?? existing.type),
        detectedLanguage: normalizeLanguage(input.language ?? existing.language ?? null),
        sampleCount: 0,
        issues: [error.message],
        warnings: [],
        validatedAt: new Date().toISOString()
      };
    }

    const issues = validateRequiredFields(candidate);
    if (issues.length > 0) {
      return {
        isValid: false,
        normalizedType: candidate.type,
        detectedLanguage: candidate.language,
        sampleCount: 0,
        issues,
        warnings: [],
        validatedAt: new Date().toISOString()
      };
    }

    if (candidate.type === SOURCE_TYPES.RSS || candidate.type === SOURCE_TYPES.API) {
      return validateRssCandidate(candidate, resolvedDeps);
    }

    if (candidate.type === SOURCE_TYPES.SCRAPER) {
      return validateScraperCandidate(candidate, resolvedDeps);
    }

    return {
      isValid: false,
      normalizedType: candidate.type,
      detectedLanguage: candidate.language,
      sampleCount: 0,
      issues: ['Unsupported source type'],
      warnings: [],
      validatedAt: new Date().toISOString()
    };
  };

  const listAdminSources = async ({ status, type, limit = 100 } = {}) => {
    const items = await resolvedDeps.listSources({ status, type, limit });
    return items.map(mapAdminSource);
  };

  const getAdminSourceById = async ({ id }) => {
    ensureObjectId(id);
    const source = await resolvedDeps.findSourceById(id);

    if (!source) {
      const error = new Error('Source not found');
      error.code = 'SOURCE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    return mapAdminSource(source);
  };

  const ensureNoDuplicates = async ({ slug, baseUrl, feedUrl, excludeId = null }) => {
    const bySlug = slug ? await resolvedDeps.findSourceBySlug(slug) : null;
    if (bySlug && String(bySlug._id) !== String(excludeId)) {
      throw createValidationError('DUPLICATE_SOURCE_SLUG', 'Source slug already exists');
    }

    const byBaseUrl = baseUrl ? await resolvedDeps.findSourceByBaseUrl(baseUrl) : null;
    if (byBaseUrl && String(byBaseUrl._id) !== String(excludeId)) {
      throw createValidationError('DUPLICATE_SOURCE_BASE_URL', 'Source baseUrl already exists');
    }

    const byFeedUrl = feedUrl ? await resolvedDeps.findSourceByEntryUrl(feedUrl) : null;
    if (byFeedUrl && String(byFeedUrl._id) !== String(excludeId)) {
      throw createValidationError('DUPLICATE_SOURCE_FEED_URL', 'Source feedUrl already exists');
    }
  };

  const createAdminSource = async (input) => {
    const validation = await validateCandidateSource(input);

    if (!validation.isValid) {
      throw createValidationError('INVALID_SOURCE_INPUT', validation.issues.join('; '));
    }

    const candidate = buildSourceRecord(input);

    await ensureNoDuplicates({
      slug: candidate.slug,
      baseUrl: candidate.baseUrl,
      feedUrl: candidate.entryUrls[0] ?? null
    });

    const created = await resolvedDeps.createSource({
      ...candidate,
      language: validation.detectedLanguage ?? candidate.language,
      validationStatus: 'valid',
      lastValidatedAt: new Date(validation.validatedAt),
      lastValidationMessage: validation.warnings[0] ?? null
    });

    return mapAdminSource(created);
  };

  const updateAdminSource = async ({ id, input }) => {
    ensureObjectId(id);
    const existing = await resolvedDeps.findSourceById(id);

    if (!existing) {
      const error = new Error('Source not found');
      error.code = 'SOURCE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    const validation = await validateCandidateSource(input, existing);

    if (!validation.isValid) {
      throw createValidationError('INVALID_SOURCE_INPUT', validation.issues.join('; '));
    }

    const candidate = buildSourceRecord(input, existing);

    await ensureNoDuplicates({
      slug: candidate.slug,
      baseUrl: candidate.baseUrl,
      feedUrl: candidate.entryUrls[0] ?? null,
      excludeId: id
    });

    const updated = await resolvedDeps.updateSourceById(id, {
      ...candidate,
      language: validation.detectedLanguage ?? candidate.language,
      validationStatus: 'valid',
      lastValidatedAt: new Date(validation.validatedAt),
      lastValidationMessage: validation.warnings[0] ?? null
    });

    return mapAdminSource(updated);
  };

  return {
    createAdminSource,
    getAdminSourceById,
    listAdminSources,
    updateAdminSource,
    validateCandidateSource
  };
};

export const {
  createAdminSource,
  getAdminSourceById,
  listAdminSources,
  updateAdminSource,
  validateCandidateSource
} = createAdminSourceService();
