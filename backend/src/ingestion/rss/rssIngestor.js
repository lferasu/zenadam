import { XMLParser } from 'fast-xml-parser';
import { upsertSourceItem } from '../../repositories/sourceItemRepository.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true
});

const asArray = (value) => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const parseFeedItems = (xmlText) => {
  const parsed = parser.parse(xmlText);
  const rssItems = asArray(parsed?.rss?.channel?.item);
  if (rssItems.length > 0) {
    return rssItems;
  }

  const atomEntries = asArray(parsed?.feed?.entry);
  return atomEntries;
};

const resolveLink = (entry) => {
  if (typeof entry?.link === 'string') {
    return entry.link;
  }

  if (entry?.link?.href) {
    return entry.link.href;
  }

  const links = asArray(entry?.link);
  return links.find((item) => item?.href)?.href ?? null;
};

const mapEntryToSourceItem = (source, entry) => {
  const publishedAt = entry.pubDate ?? entry.published ?? entry.updated ?? null;
  const description = entry['content:encoded'] ?? entry.description ?? entry.summary ?? '';
  const url = resolveLink(entry);
  const externalId = entry.guid?.['#text'] ?? entry.guid ?? entry.id ?? url ?? entry.title;

  return {
    sourceId: source._id,
    externalId: String(externalId),
    url,
    title: entry.title ?? '',
    rawPayload: entry,
    rawText: description,
    publishedAt,
    fetchedAt: new Date()
  };
};

const fetchFeedXml = async (url, fetchConfig = {}) => {
  const timeoutMs = Number(fetchConfig.timeoutMs ?? 15000);
  const userAgent = fetchConfig.userAgent ?? 'ZenadamBot/0.1';

  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed (${response.status}) for ${url}`);
  }

  return response.text();
};

export const ingestRssSource = async (source) => {
  const entryUrls = Array.isArray(source.entryUrls) ? source.entryUrls : [];
  const ingestResults = [];

  for (const entryUrl of entryUrls) {
    const xml = await fetchFeedXml(entryUrl, source.fetchConfig);
    const entries = parseFeedItems(xml);
    let upserted = 0;

    for (const entry of entries) {
      const mapped = mapEntryToSourceItem(source, entry);

      if (!mapped.externalId || !mapped.url || !mapped.title) {
        continue;
      }

      await upsertSourceItem(mapped);
      upserted += 1;
    }

    ingestResults.push({
      entryUrl,
      fetchedEntries: entries.length,
      upserted
    });
  }

  return ingestResults;
};
