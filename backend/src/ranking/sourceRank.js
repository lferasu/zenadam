import { STORY_RANKING_DEFAULTS } from './constants.js';
import { clamp01 } from './signalUtils.js';

const SOURCE_SCORE_FIELDS = [
  'rank',
  'rankScore',
  'priority',
  'priorityScore',
  'trustScore',
  'qualityScore',
  'authorityScore',
  'reliabilityScore',
  'weight'
];

const normalizeSourceField = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric >= 0 && numeric <= 1) {
    return numeric;
  }

  if (numeric > 1 && numeric <= 100) {
    return numeric / 100;
  }

  return null;
};

export const getSourceRankScore = (source) => {
  const sourceQualityScore = normalizeSourceField(source?.sourceQuality?.score);
  if (sourceQualityScore !== null) {
    return clamp01(sourceQualityScore);
  }

  for (const field of SOURCE_SCORE_FIELDS) {
    const normalized = normalizeSourceField(source?.[field]);
    if (normalized !== null) {
      return clamp01(normalized);
    }
  }

  const base = STORY_RANKING_DEFAULTS.sourceRankDefault;
  const activeBonus = source?.status === 'active' ? 0.03 : 0;
  const rssBonus = source?.type === 'rss' ? 0.02 : 0;
  return clamp01(base + activeBonus + rssBonus);
};
