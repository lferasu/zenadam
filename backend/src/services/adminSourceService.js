import { ObjectId } from 'mongodb';
import { CANDIDATE_SOURCE_STATUS } from '../models/CandidateSource.js';
import { SOURCE_STATUS, SOURCE_TYPES } from '../models/Source.js';
import {
  createCandidateSource,
  findCandidateSourceByBaseUrl,
  findCandidateSourceByEntryUrl,
  findCandidateSourceById,
  findCandidateSourceBySlug,
  listCandidateSources,
  updateCandidateSourceById
} from '../repositories/candidateSourceRepository.js';
import {
  createSource,
  findSourceByBaseUrl,
  findSourceByEntryUrl,
  findSourceById,
  findSourceBySlug,
  listSources,
  updateSourceById
} from '../repositories/sourceRepository.js';
import { fetchFeedXml, parseFeedItems } from '../ingestion/rss/rssIngestor.js';
import { detectLanguage } from './languageDetectionService.js';

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

const mapValidationStatus = (validation) => {
  if (!validation) {
    return 'not_run';
  }

  if (validation.errorMessage) {
    return 'failed';
  }

  if (validation.isValid) {
    return validation.warnings?.length ? 'warning' : 'valid';
  }

  return 'invalid';
};

const mapValidationMessage = (validation) => {
  if (!validation) {
    return null;
  }

  if (validation.errorMessage) {
    return validation.errorMessage;
  }

  return validation.issues?.[0] ?? validation.warnings?.[0] ?? null;
};

const mapValidationChecks = (validation) => validation?.checks ?? null;

const mapAdminSource = (source, options = {}) => {
  const validation = source.lastValidationResult ?? null;
  const isCandidate = options.isCandidate === true;

  return {
    id: String(source._id),
    slug: source.slug,
    name: source.name,
    type: source.type,
    baseUrl: source.baseUrl ?? null,
    feedUrl: source.entryUrls?.[0] ?? null,
    entryUrls: source.entryUrls ?? [],
    language: source.language ?? null,
    category: source.category ?? null,
    status: isCandidate ? CANDIDATE_SOURCE_STATUS.CANDIDATE : source.status ?? SOURCE_STATUS.ACTIVE,
    isActive: !isCandidate && source.status === SOURCE_STATUS.ACTIVE,
    isCandidate,
    isEditable: isCandidate,
    sourceSet: isCandidate ? 'candidate_sources' : 'sources',
    validationStatus: source.validationStatus ?? mapValidationStatus(validation),
    validationResults: validation,
    validationChecks: mapValidationChecks(validation),
    lastValidatedAt: source.lastValidatedAt?.toISOString?.() ?? validation?.validatedAt ?? null,
    lastValidationMessage: source.lastValidationMessage ?? mapValidationMessage(validation),
    createdAt: source.createdAt?.toISOString?.() ?? null,
    updatedAt: source.updatedAt?.toISOString?.() ?? null
  };
};

const createValidationError = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const ensureObjectId = (id) => {
  if (!ObjectId.isValid(id)) {
    throw createValidationError('INVALID_SOURCE_ID', 'Invalid source id');
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

const buildValidationResult = ({
  normalizedType,
  detectedLanguage,
  sampleCount = 0,
  homepageReachable = null,
  feedReachable = null,
  feedParseable = null,
  feedHasItems = null,
  issues = [],
  warnings = [],
  errorMessage = null
}) => ({
  isValid: issues.length === 0,
  normalizedType,
  detectedLanguage,
  sampleCount,
  issues,
  warnings,
  errorMessage,
  checks: {
    homepageReachable,
    feedReachable,
    feedParseable,
    feedHasItems
  },
  validatedAt: new Date().toISOString()
});

const validateHomepage = async (url, deps, fetchConfig) => {
  if (!url) {
    return { reachable: null, issue: null };
  }

  try {
    const response = await deps.fetch(url, {
      headers: {
        'user-agent': fetchConfig?.userAgent ?? DEFAULT_FETCH_CONFIG.userAgent
      },
      signal: AbortSignal.timeout(fetchConfig?.timeoutMs ?? DEFAULT_FETCH_CONFIG.timeoutMs)
    });

    if (!response.ok) {
      return {
        reachable: false,
        issue: `Homepage fetch failed (${response.status}) for ${url}`
      };
    }

    return { reachable: true, issue: null };
  } catch (error) {
    return {
      reachable: false,
      issue: `Homepage fetch failed for ${url}: ${error.message}`
    };
  }
};

const validateRssCandidate = async (candidate, deps) => {
  const issues = [];
  const warnings = [];
  let sampleCount = 0;
  let detectedLanguage = candidate.language ?? null;
  let feedReachable = false;
  let feedParseable = false;
  let feedHasItems = false;

  const homepageCheck = await validateHomepage(candidate.baseUrl, deps, candidate.fetchConfig);
  if (homepageCheck.issue) {
    warnings.push(homepageCheck.issue);
  }

  try {
    const fetchResult = await deps.fetchFeedXml(candidate.entryUrls[0], candidate.fetchConfig);
    feedReachable = true;
    const entries = parseFeedItems(fetchResult.xml ?? '');
    feedParseable = true;
    sampleCount = entries.length;
    feedHasItems = entries.length > 0;

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

  return buildValidationResult({
    normalizedType: SOURCE_TYPES.RSS,
    detectedLanguage,
    sampleCount,
    homepageReachable: homepageCheck.reachable,
    feedReachable,
    feedParseable,
    feedHasItems,
    issues,
    warnings
  });
};

const validateScraperCandidate = async (candidate, deps) => {
  const issues = [];
  const warnings = ['Scraper ingestion is not implemented yet; validation only checks fetchability and HTML readability.'];
  let detectedLanguage = candidate.language ?? null;
  let sampleCount = 0;

  const homepageCheck = await validateHomepage(candidate.baseUrl, deps, candidate.fetchConfig);

  if (homepageCheck.issue) {
    issues.push(homepageCheck.issue);
  }

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

  return buildValidationResult({
    normalizedType: SOURCE_TYPES.SCRAPER,
    detectedLanguage,
    sampleCount,
    homepageReachable: homepageCheck.reachable,
    feedReachable: null,
    feedParseable: null,
    feedHasItems: null,
    issues,
    warnings
  });
};

const sortSources = (items) =>
  [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? 0);
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? 0);
    return rightTime - leftTime;
  });

const findFirstMatch = async (lookups = []) => {
  for (const lookup of lookups) {
    const result = await lookup();
    if (result) {
      return result;
    }
  }

  return null;
};

export const createAdminSourceService = (deps = {}) => {
  const resolvedDeps = {
    createCandidateSource: deps.createCandidateSource ?? createCandidateSource,
    createSource: deps.createSource ?? createSource,
    fetch: deps.fetch ?? fetch,
    fetchFeedXml: deps.fetchFeedXml ?? fetchFeedXml,
    detectLanguage: deps.detectLanguage ?? detectLanguage,
    findCandidateSourceByBaseUrl: deps.findCandidateSourceByBaseUrl ?? findCandidateSourceByBaseUrl,
    findCandidateSourceByEntryUrl: deps.findCandidateSourceByEntryUrl ?? findCandidateSourceByEntryUrl,
    findCandidateSourceById: deps.findCandidateSourceById ?? findCandidateSourceById,
    findCandidateSourceBySlug: deps.findCandidateSourceBySlug ?? findCandidateSourceBySlug,
    findSourceByBaseUrl: deps.findSourceByBaseUrl ?? findSourceByBaseUrl,
    findSourceByEntryUrl: deps.findSourceByEntryUrl ?? findSourceByEntryUrl,
    findSourceById: deps.findSourceById ?? findSourceById,
    findSourceBySlug: deps.findSourceBySlug ?? findSourceBySlug,
    listCandidateSources: deps.listCandidateSources ?? listCandidateSources,
    listSources: deps.listSources ?? listSources,
    updateCandidateSourceById: deps.updateCandidateSourceById ?? updateCandidateSourceById,
    updateSourceById: deps.updateSourceById ?? updateSourceById
  };

  const validateCandidateSource = async (input, existing = {}) => {
    let candidate;

    try {
      candidate = buildSourceRecord(input, existing);
    } catch (error) {
      return buildValidationResult({
        normalizedType: normalizeSourceType(input.type ?? existing.type),
        detectedLanguage: normalizeLanguage(input.language ?? existing.language ?? null),
        issues: [error.message]
      });
    }

    const issues = validateRequiredFields(candidate);
    if (issues.length > 0) {
      return buildValidationResult({
        normalizedType: candidate.type,
        detectedLanguage: candidate.language,
        issues
      });
    }

    if (candidate.type === SOURCE_TYPES.RSS || candidate.type === SOURCE_TYPES.API) {
      return validateRssCandidate(candidate, resolvedDeps);
    }

    if (candidate.type === SOURCE_TYPES.SCRAPER) {
      return validateScraperCandidate(candidate, resolvedDeps);
    }

    return buildValidationResult({
      normalizedType: candidate.type,
      detectedLanguage: candidate.language,
      issues: ['Unsupported source type']
    });
  };

  const listAdminSources = async ({ status, type, limit = 100 } = {}) => {
    const sourceLimit = Math.max(limit, 1);
    const [activeSources, candidateSources] = await Promise.all([
      status === CANDIDATE_SOURCE_STATUS.CANDIDATE ? [] : resolvedDeps.listSources({ status, type, limit: sourceLimit }),
      !status || status === CANDIDATE_SOURCE_STATUS.CANDIDATE ? resolvedDeps.listCandidateSources({ type, limit: sourceLimit }) : []
    ]);

    return sortSources([
      ...activeSources.map((source) => mapAdminSource(source, { isCandidate: false })),
      ...candidateSources.map((source) => mapAdminSource(source, { isCandidate: true }))
    ]).slice(0, limit);
  };

  const getAdminSourceById = async ({ id }) => {
    ensureObjectId(id);
    const [activeSource, candidateSource] = await Promise.all([
      resolvedDeps.findSourceById(id),
      resolvedDeps.findCandidateSourceById(id)
    ]);
    const source = activeSource ?? candidateSource;

    if (!source) {
      throw createValidationError('SOURCE_NOT_FOUND', 'Source not found', 404);
    }

    return mapAdminSource(source, { isCandidate: Boolean(candidateSource && !activeSource) });
  };

  const ensureNoDuplicates = async ({ slug, baseUrl, feedUrl, excludeId = null }) => {
    const bySlug = slug
      ? await findFirstMatch([
          () => resolvedDeps.findSourceBySlug(slug),
          () => resolvedDeps.findCandidateSourceBySlug(slug)
        ])
      : null;
    if (bySlug && String(bySlug._id) !== String(excludeId)) {
      throw createValidationError('DUPLICATE_SOURCE_SLUG', 'Source slug already exists');
    }

    const byBaseUrl = baseUrl
      ? await findFirstMatch([
          () => resolvedDeps.findSourceByBaseUrl(baseUrl),
          () => resolvedDeps.findCandidateSourceByBaseUrl(baseUrl)
        ])
      : null;
    if (byBaseUrl && String(byBaseUrl._id) !== String(excludeId)) {
      throw createValidationError('DUPLICATE_SOURCE_BASE_URL', 'Source baseUrl already exists');
    }

    const byFeedUrl = feedUrl
      ? await findFirstMatch([
          () => resolvedDeps.findSourceByEntryUrl(feedUrl),
          () => resolvedDeps.findCandidateSourceByEntryUrl(feedUrl)
        ])
      : null;
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
      validationStatus: mapValidationStatus(validation),
      lastValidatedAt: new Date(validation.validatedAt),
      lastValidationMessage: mapValidationMessage(validation),
      lastValidationResult: validation
    });

    return mapAdminSource(created, { isCandidate: false });
  };

  const createAdminCandidateSource = async (input) => {
    const candidate = buildSourceRecord(input);
    const requiredIssues = validateRequiredFields(candidate);

    if (requiredIssues.length > 0) {
      throw createValidationError('INVALID_SOURCE_INPUT', requiredIssues.join('; '));
    }

    await ensureNoDuplicates({
      slug: candidate.slug,
      baseUrl: candidate.baseUrl,
      feedUrl: candidate.entryUrls[0] ?? null
    });

    const validation = await validateCandidateSource(input);
    const created = await resolvedDeps.createCandidateSource({
      ...candidate,
      language: validation.detectedLanguage ?? candidate.language,
      status: CANDIDATE_SOURCE_STATUS.CANDIDATE,
      validationStatus: mapValidationStatus(validation),
      lastValidatedAt: validation.validatedAt ? new Date(validation.validatedAt) : null,
      lastValidationMessage: mapValidationMessage(validation),
      lastValidationResult: validation
    });

    return mapAdminSource(created, { isCandidate: true });
  };

  const updateAdminSource = async ({ id, input }) => {
    ensureObjectId(id);
    const existing = await resolvedDeps.findSourceById(id);

    if (!existing) {
      throw createValidationError('SOURCE_NOT_FOUND', 'Source not found', 404);
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
      validationStatus: mapValidationStatus(validation),
      lastValidatedAt: new Date(validation.validatedAt),
      lastValidationMessage: mapValidationMessage(validation),
      lastValidationResult: validation
    });

    return mapAdminSource(updated, { isCandidate: false });
  };

  const updateAdminCandidateSource = async ({ id, input }) => {
    ensureObjectId(id);
    const existing = await resolvedDeps.findCandidateSourceById(id);

    if (!existing) {
      throw createValidationError('SOURCE_NOT_FOUND', 'Source not found', 404);
    }

    const candidate = buildSourceRecord(input, existing);
    const requiredIssues = validateRequiredFields(candidate);

    if (requiredIssues.length > 0) {
      throw createValidationError('INVALID_SOURCE_INPUT', requiredIssues.join('; '));
    }

    await ensureNoDuplicates({
      slug: candidate.slug,
      baseUrl: candidate.baseUrl,
      feedUrl: candidate.entryUrls[0] ?? null,
      excludeId: id
    });

    const validation = await validateCandidateSource(input, existing);
    const updated = await resolvedDeps.updateCandidateSourceById(id, {
      ...candidate,
      language: validation.detectedLanguage ?? candidate.language,
      status: CANDIDATE_SOURCE_STATUS.CANDIDATE,
      validationStatus: mapValidationStatus(validation),
      lastValidatedAt: validation.validatedAt ? new Date(validation.validatedAt) : null,
      lastValidationMessage: mapValidationMessage(validation),
      lastValidationResult: validation
    });

    return mapAdminSource(updated, { isCandidate: true });
  };

  return {
    createAdminCandidateSource,
    createAdminSource,
    getAdminSourceById,
    listAdminSources,
    updateAdminCandidateSource,
    updateAdminSource,
    validateCandidateSource
  };
};

export const {
  createAdminCandidateSource,
  createAdminSource,
  getAdminSourceById,
  listAdminSources,
  updateAdminCandidateSource,
  updateAdminSource,
  validateCandidateSource
} = createAdminSourceService();
