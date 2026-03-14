import { XMLParser } from 'fast-xml-parser';
import { logger } from '../../config/logger.js';
import { upsertSourceItem } from '../../repositories/sourceItemRepository.js';
import { extractImageFromRssEntry } from './rssImageExtractor.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true
});

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_USER_AGENT = 'ZenadamBot/0.1';
const DEFAULT_RETRIES = 2;
const DEFAULT_SUMMARY_MAX_LENGTH = 800;

const asArray = (value) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const cleanupTitle = (title, cleanupRules = []) => {
  if (typeof title !== 'string') {
    return '';
  }

  let cleaned = title.trim();

  for (const rule of cleanupRules) {
    if (!rule) {
      continue;
    }

    if (typeof rule === 'string') {
      cleaned = cleaned.replaceAll(rule, '').trim();
      continue;
    }

    if (rule.pattern) {
      try {
        const flags = typeof rule.flags === 'string' ? rule.flags : 'g';
        const regex = new RegExp(rule.pattern, flags);
        cleaned = cleaned.replace(regex, rule.replacement ?? '').trim();
      } catch {
        // Ignore malformed cleanup rules to keep ingestion resilient.
      }
    }
  }

  return cleaned;
};

const normalizeText = (text, { stripHtml = false, summaryMaxLength = DEFAULT_SUMMARY_MAX_LENGTH } = {}) => {
  if (typeof text !== 'string') {
    return '';
  }

  const htmlStripped = stripHtml ? text.replace(/<[^>]+>/g, ' ') : text;
  const collapsed = htmlStripped.replace(/\s+/g, ' ').trim();

  if (!summaryMaxLength || collapsed.length <= summaryMaxLength) {
    return collapsed;
  }

  return `${collapsed.slice(0, summaryMaxLength).trim()}…`;
};

export const parseFeedItems = (xmlText) => {
  const parsed = parser.parse(xmlText);
  const rssItems = asArray(parsed?.rss?.channel?.item);

  if (rssItems.length > 0) {
    return rssItems;
  }

  return asArray(parsed?.feed?.entry);
};

const resolveLink = (entry) => {
  if (typeof entry?.link === 'string') {
    return entry.link;
  }

  if (entry?.url) {
    return entry.url;
  }

  if (entry?.link?.href) {
    return entry.link.href;
  }

  const links = asArray(entry?.link);
  return links.find((item) => item?.href)?.href ?? null;
};

const resolveExternalId = (entry, url) => {
  if (entry?.guid?.['#text']) {
    return entry.guid['#text'];
  }

  return entry?.guid ?? entry?.id ?? url ?? entry?.title ?? null;
};

const resolvePublishedAt = (entry, preferredDateField) => {
  const fallbacks = [preferredDateField, 'pubDate', 'published', 'updated'].filter(Boolean);

  for (const field of fallbacks) {
    if (entry?.[field]) {
      return entry[field];
    }
  }

  return null;
};

const resolveContent = (entry, preferredContentField) => {
  const fields = [preferredContentField, 'content:encoded', 'description', 'summary', 'content'].filter(Boolean);

  for (const field of fields) {
    const value = entry?.[field];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (value?.['#text']) {
      return value['#text'];
    }
  }

  return '';
};

const mapEntryToSourceItem = (source, entry) => {
  const parserConfig = source?.parserConfig ?? {};
  const normalizationConfig = source?.normalizationConfig ?? {};

  const url = resolveLink(entry);
  const externalId = resolveExternalId(entry, url);
  const title = cleanupTitle(entry?.title ?? '', normalizationConfig.titleCleanupRules);
  const publishedAt = resolvePublishedAt(entry, parserConfig.preferredDateField);
  const content = resolveContent(entry, parserConfig.preferredContentField);
  const image = extractImageFromRssEntry(entry);
  const rawText = normalizeText(content, {
    stripHtml: Boolean(normalizationConfig.stripHtml),
    summaryMaxLength: normalizationConfig.summaryMaxLength
  });

  return {
    sourceId: source._id,
    externalId: externalId ? String(externalId) : '',
    url,
    title,
    ...(image ? { image: { ...image, status: 'found' } } : {}),
    rawPayload: entry,
    rawText,
    publishedAt,
    fetchedAt: new Date()
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchFeedXml = async (url, fetchConfig = {}) => {
  const timeoutMs = Number(fetchConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const userAgent = fetchConfig.userAgent ?? DEFAULT_USER_AGENT;
  const retries = Number(fetchConfig.retries ?? DEFAULT_RETRIES);
  const retryDelayMs = Number(fetchConfig.retryDelayMs ?? 300);

  const headers = {
    ...(fetchConfig.headers ?? {}),
    'user-agent': userAgent
  };

  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (response.status === 304) {
        return { xml: null, notModified: true };
      }

      if (!response.ok) {
        throw new Error(`RSS fetch failed (${response.status}) for ${url}`);
      }

      const xml = await response.text();
      return { xml, notModified: false };
    } catch (error) {
      lastError = error;

      if (attempt <= retries) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw lastError;
};

export const ingestRssSource = async (source) => {
  const entryUrls = Array.isArray(source.entryUrls) ? source.entryUrls : [];

  const result = {
    sourceId: source._id,
    sourceSlug: source.slug,
    sourceType: source.type,
    status: 'success',
    totals: {
      feedsSucceeded: 0,
      feedsFailed: 0,
      itemsFetched: 0,
      itemsInserted: 0,
      itemsSkipped: 0
    },
    feeds: []
  };

  for (const entryUrl of entryUrls) {
    const feedResult = {
      entryUrl,
      status: 'success',
      fetchedEntries: 0,
      inserted: 0,
      skipped: 0
    };

    try {
      const fetchResult = await fetchFeedXml(entryUrl, source.fetchConfig);

      if (fetchResult.notModified) {
        feedResult.status = 'not_modified';
        result.totals.feedsSucceeded += 1;
        result.feeds.push(feedResult);
        continue;
      }

      const xml = fetchResult.xml;
      const entries = parseFeedItems(xml);

      feedResult.fetchedEntries = entries.length;
      result.totals.itemsFetched += entries.length;

      for (const entry of entries) {
        try {
          const mapped = mapEntryToSourceItem(source, entry);

          if (!mapped.externalId || !mapped.url || !mapped.title) {
            feedResult.skipped += 1;
            result.totals.itemsSkipped += 1;
            continue;
          }

          const upsertResult = await upsertSourceItem(mapped);
          const wasInserted = Boolean(upsertResult.inserted);

          if (wasInserted) {
            feedResult.inserted += 1;
            result.totals.itemsInserted += 1;
          } else {
            feedResult.skipped += 1;
            result.totals.itemsSkipped += 1;
          }
        } catch (error) {
          feedResult.skipped += 1;
          result.totals.itemsSkipped += 1;

          logger.warn('Failed to parse or upsert RSS item', {
            sourceSlug: source.slug,
            entryUrl,
            message: error.message
          });
        }
      }

      result.totals.feedsSucceeded += 1;
    } catch (error) {
      feedResult.status = 'failed';
      feedResult.error = error.message;
      result.totals.feedsFailed += 1;
      result.status = 'partial_failure';

      logger.warn('Failed to ingest RSS feed URL', {
        sourceSlug: source.slug,
        entryUrl,
        message: error.message
      });
    }

    result.feeds.push(feedResult);
  }

  if (result.totals.feedsFailed > 0 && result.totals.feedsSucceeded === 0) {
    result.status = 'failed';
  }

  return result;
};
