import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadHtml } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../config/logger.js';
import { SOURCE_TYPES } from '../models/Source.js';
import { findActiveSourcesByType, updateSourceAuditState } from '../repositories/sourceRepository.js';
import { ensureRuntimeInitialized } from '../services/runtimeService.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true
});

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_USER_AGENT = 'ZenadamBot/0.1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPORT_PATH = path.resolve(__dirname, '../../tmp/source-audit-report.json');

const asArray = (value) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const classifyFreshness = (latestPublishedAt) => {
  if (!latestPublishedAt) {
    return 'unknown';
  }

  const publishedAt = new Date(latestPublishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    return 'unknown';
  }

  const ageDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 3) {
    return 'fresh';
  }
  if (ageDays <= 14) {
    return 'ok';
  }
  if (ageDays <= 30) {
    return 'aging';
  }
  return 'stale';
};

const resolvePublishedAt = (entry) => {
  const dateFields = ['pubDate', 'published', 'updated'];
  for (const field of dateFields) {
    if (entry?.[field]) {
      return entry[field];
    }
  }

  return null;
};

const parseFeedItems = (xmlText) => {
  const parsed = parser.parse(xmlText);
  const rssItems = asArray(parsed?.rss?.channel?.item);
  if (rssItems.length > 0) {
    return rssItems;
  }

  return asArray(parsed?.feed?.entry);
};

const getFetchOptions = (source) => {
  const fetchConfig = source.fetchConfig ?? {};
  const timeoutMs = Number(fetchConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const userAgent = fetchConfig.userAgent ?? DEFAULT_USER_AGENT;

  return {
    timeoutMs,
    headers: {
      ...(fetchConfig.headers ?? {}),
      'user-agent': userAgent
    }
  };
};

const fetchUrl = async (url, source) => {
  const { headers, timeoutMs } = getFetchOptions(source);
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = await response.text();
  const contentType = response.headers.get('content-type');

  return {
    body,
    finalUrl: response.url,
    contentType
  };
};

const auditRssSource = async (source) => {
  const entryUrls = Array.isArray(source.entryUrls) ? source.entryUrls : [];
  let itemCount = 0;
  let latestPublishedAt = null;
  let feedsSucceeded = 0;
  let feedsFailed = 0;
  const feedErrors = [];
  const testedUrls = [];

  for (const entryUrl of entryUrls) {
    try {
      const fetched = await fetchUrl(entryUrl, source);
      testedUrls.push({
        url: entryUrl,
        finalUrl: fetched.finalUrl,
        contentType: fetched.contentType,
        status: 'ok'
      });

      let items = [];
      try {
        items = parseFeedItems(fetched.body);
      } catch (error) {
        feedsFailed += 1;
        feedErrors.push(`${entryUrl}: invalid XML (${error.message})`);
        testedUrls[testedUrls.length - 1].status = 'failed';
        continue;
      }

      if (!items.length) {
        feedsFailed += 1;
        feedErrors.push(`${entryUrl}: parsed but empty`);
        testedUrls[testedUrls.length - 1].status = 'warn';
        continue;
      }

      feedsSucceeded += 1;
      itemCount += items.length;

      for (const entry of items) {
        const candidateDate = resolvePublishedAt(entry);
        if (!candidateDate) {
          continue;
        }

        const date = new Date(candidateDate);
        if (Number.isNaN(date.getTime())) {
          continue;
        }

        if (!latestPublishedAt || date > new Date(latestPublishedAt)) {
          latestPublishedAt = date.toISOString();
        }
      }
    } catch (error) {
      feedsFailed += 1;
      feedErrors.push(`${entryUrl}: ${error.message}`);
      testedUrls.push({
        url: entryUrl,
        status: 'failed'
      });
    }
  }

  const freshness = classifyFreshness(latestPublishedAt);
  let status = 'pass';
  let reason = 'RSS source reachable and parseable with feed items.';

  if (feedsSucceeded === 0) {
    status = 'fail';
    reason = feedErrors.join(' | ') || 'No successful RSS URLs.';
  } else if (!latestPublishedAt || freshness === 'unknown') {
    status = 'warn';
    reason = 'RSS parsed but latest published date is missing or invalid.';
  } else if (freshness === 'stale' || freshness === 'aging') {
    status = 'warn';
    reason = `RSS feed is ${freshness}.`;
  } else if (feedsFailed > 0) {
    status = 'warn';
    reason = `Some feed URLs failed (${feedsFailed}/${entryUrls.length}).`;
  }

  return {
    sourceId: String(source._id),
    slug: source.slug,
    name: source.name,
    type: source.type,
    testedUrls,
    status,
    reason,
    itemCount,
    latestPublishedAt,
    freshness,
    scrapable: null,
    auditedAt: new Date().toISOString()
  };
};

const collectLinksWithSelectors = ($, selectors) => {
  const links = new Set();

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const href = $(element).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        links.add(href);
      }
    });
  }

  return [...links];
};

const auditScraperSource = async (source) => {
  const entryUrls = Array.isArray(source.entryUrls) ? source.entryUrls : [];
  const parserConfig = source.parserConfig ?? {};
  const selectorConfig = parserConfig.articleLinkSelector;
  const selectors = selectorConfig
    ? (Array.isArray(selectorConfig) ? selectorConfig : [selectorConfig])
    : ['article a[href]', 'h2 a[href]', 'h3 a[href]', 'main a[href]'];

  let articleLinkCount = 0;
  let pagesSucceeded = 0;
  let pagesFailed = 0;
  const testedUrls = [];
  const pageErrors = [];

  for (const entryUrl of entryUrls) {
    try {
      const fetched = await fetchUrl(entryUrl, source);
      const $ = loadHtml(fetched.body);
      const links = collectLinksWithSelectors($, selectors);
      articleLinkCount += links.length;
      pagesSucceeded += 1;

      testedUrls.push({
        url: entryUrl,
        finalUrl: fetched.finalUrl,
        contentType: fetched.contentType,
        status: 'ok',
        articleLikeLinks: links.length
      });
    } catch (error) {
      pagesFailed += 1;
      pageErrors.push(`${entryUrl}: ${error.message}`);
      testedUrls.push({
        url: entryUrl,
        status: 'failed'
      });
    }
  }

  let status = 'pass';
  let reason = 'Scraper entry page is reachable and has article-like links.';
  let scrapable = true;

  if (pagesSucceeded === 0) {
    status = 'fail';
    reason = pageErrors.join(' | ') || 'No successful scraper entry page.';
    scrapable = false;
  } else if (articleLinkCount < Math.max(2, pagesSucceeded)) {
    status = 'warn';
    reason = 'Scraper page reachable but article-link extraction signal is weak.';
    scrapable = false;
  } else if (pagesFailed > 0) {
    status = 'warn';
    reason = `Some scraper entry URLs failed (${pagesFailed}/${entryUrls.length}).`;
  }

  return {
    sourceId: String(source._id),
    slug: source.slug,
    name: source.name,
    type: source.type,
    testedUrls,
    status,
    reason,
    itemCount: null,
    articleLinkCount,
    latestPublishedAt: null,
    freshness: null,
    scrapable,
    auditedAt: new Date().toISOString()
  };
};

const auditApiSource = async (source) => {
  return {
    sourceId: String(source._id),
    slug: source.slug,
    name: source.name,
    type: source.type,
    testedUrls: [],
    status: 'warn',
    reason: 'API source audit is not implemented yet.',
    itemCount: null,
    latestPublishedAt: null,
    freshness: null,
    scrapable: null,
    auditedAt: new Date().toISOString()
  };
};

const auditSource = async (source) => {
  if (source.type === SOURCE_TYPES.RSS) {
    return auditRssSource(source);
  }
  if (source.type === SOURCE_TYPES.SCRAPER) {
    return auditScraperSource(source);
  }
  if (source.type === SOURCE_TYPES.API) {
    return auditApiSource(source);
  }

  return {
    sourceId: String(source._id),
    slug: source.slug,
    name: source.name,
    type: source.type,
    testedUrls: [],
    status: 'warn',
    reason: `Unsupported source type: ${source.type}`,
    itemCount: null,
    latestPublishedAt: null,
    freshness: null,
    scrapable: null,
    auditedAt: new Date().toISOString()
  };
};

const summarizeAudit = (results) => {
  const summary = {
    totalSourcesAudited: results.length,
    pass: 0,
    warn: 0,
    fail: 0,
    byType: {},
    freshness: {
      fresh: 0,
      ok: 0,
      aging: 0,
      stale: 0,
      unknown: 0
    }
  };

  for (const result of results) {
    summary[result.status] += 1;
    summary.byType[result.type] = (summary.byType[result.type] ?? 0) + 1;

    if (result.freshness) {
      summary.freshness[result.freshness] = (summary.freshness[result.freshness] ?? 0) + 1;
    } else if (result.type === SOURCE_TYPES.RSS) {
      summary.freshness.unknown += 1;
    }
  }

  return summary;
};

const toAuditState = (result) => {
  const healthStatus = result.status === 'pass' ? 'healthy' : result.status === 'warn' ? 'degraded' : 'unhealthy';
  const latestPublishedAt = result.latestPublishedAt ? new Date(result.latestPublishedAt) : null;

  return {
    healthStatus,
    healthReason: result.reason,
    healthFreshness: result.freshness,
    healthScrapable: result.scrapable,
    healthItemCount: result.itemCount ?? result.articleLinkCount ?? null,
    healthLastSuccessfulFetchAt: result.status === 'fail' ? null : latestPublishedAt ?? new Date(),
    incrementFailureCount: result.status === 'fail'
  };
};

const ensureReportDir = async (reportPath) => {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
};

export const runSourceAudit = async ({ writeBack = false, reportPath = DEFAULT_REPORT_PATH } = {}) => {
  await ensureRuntimeInitialized();

  const sources = await findActiveSourcesByType();
  const results = [];

  for (const source of sources) {
    try {
      const result = await auditSource(source);
      results.push(result);

      if (writeBack) {
        await updateSourceAuditState(source._id, toAuditState(result));
      }
    } catch (error) {
      const failed = {
        sourceId: String(source._id),
        slug: source.slug,
        name: source.name,
        type: source.type,
        testedUrls: [],
        status: 'fail',
        reason: error.message,
        itemCount: null,
        latestPublishedAt: null,
        freshness: null,
        scrapable: null,
        auditedAt: new Date().toISOString()
      };
      results.push(failed);

      if (writeBack) {
        await updateSourceAuditState(source._id, toAuditState(failed));
      }
    }
  }

  const summary = summarizeAudit(results);
  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    results
  };

  await ensureReportDir(reportPath);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return {
    reportPath,
    report
  };
};

export const printAuditSummary = (report) => {
  const rows = report.results.map((item) => ({
    slug: item.slug,
    type: item.type,
    status: item.status,
    freshness: item.freshness ?? '-',
    items: item.itemCount ?? '-',
    links: item.articleLinkCount ?? '-',
    reason: item.reason
  }));

  console.table(rows);
  logger.info('Source audit summary', report.summary);
};
