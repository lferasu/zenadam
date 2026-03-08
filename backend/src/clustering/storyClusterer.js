import { buildDedupeHash } from '../utils/hash.js';
import { normalizeText, tokenizeTitle } from '../utils/text.js';

const toDayKey = (value) => {
  if (!value) {
    return 'unknown-day';
  }

  return new Date(value).toISOString().slice(0, 10);
};

const buildTitleKey = (title, fallbackHash) => {
  const tokens = tokenizeTitle(title).slice(0, 4);
  if (tokens.length) {
    return tokens.sort().join('-');
  }

  return fallbackHash.slice(0, 12);
};

const buildClusterKey = (item) => {
  const dayKey = toDayKey(item.publishedAt ?? item.createdAt);
  const fallbackHash = buildDedupeHash({
    title: item.title,
    content: item.content,
    publishedAt: item.publishedAt
  });
  const titleKey = buildTitleKey(item.title, fallbackHash);
  return `${item.language}:${dayKey}:${titleKey}`;
};

const buildSummary = (item) => {
  const text = normalizeText(item.content || item.title || '');
  return text.slice(0, 220);
};

export const clusterNormalizedItems = (items) => {
  const grouped = new Map();

  for (const item of items) {
    const clusterKey = buildClusterKey(item);
    const existing = grouped.get(clusterKey) ?? [];
    existing.push(item);
    grouped.set(clusterKey, existing);
  }

  const clusters = [];
  for (const [clusterKey, clusterItems] of grouped.entries()) {
    const sorted = [...clusterItems].sort((a, b) => {
      return new Date(b.publishedAt ?? b.createdAt) - new Date(a.publishedAt ?? a.createdAt);
    });
    const hero = sorted[0];
    const title = normalizeText(hero.title || 'Untitled story');

    clusters.push({
      clusterKey,
      language: hero.language || 'am',
      title,
      summary: buildSummary(hero),
      heroItemId: hero.sourceItemId,
      itemIds: sorted.map((item) => item.sourceItemId),
      normalizedItemIds: sorted.map((item) => item._id),
      sourceIds: [...new Set(sorted.map((item) => String(item.sourceId)))]
    });
  }

  return clusters;
};
