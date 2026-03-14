import { SOURCE_STATUS, SOURCE_TYPES } from '../models/Source.js';
import { clamp01 } from './signalUtils.js';

export const SOURCE_QUALITY_STRATEGY_VERSION = 'source-quality-v1';

const CURATED_SOURCE_QUALITY_BY_SLUG = Object.freeze({
  'bbc-amharic': { score: 0.95, rationale: 'trusted_global_public_broadcaster' },
  'dw-amharic': { score: 0.92, rationale: 'trusted_international_public_broadcaster' },
  'voa-amharic': { score: 0.88, rationale: 'established_international_broadcaster' },
  'the-eastafrican': { score: 0.84, rationale: 'regional_newspaper_with_broad_coverage' },
  'the-new-times-rwanda': { score: 0.78, rationale: 'regional_daily_newsroom' },
  'capital-fm-kenya': { score: 0.76, rationale: 'regional_broadcast_newsroom' },
  'ethiopian-reporter-am': { score: 0.74, rationale: 'local_newsroom_with_recognized_editorial_presence' },
  'fana-amharic': { score: 0.72, rationale: 'state_aligned_broadcaster_with_regular_output' },
  'zehabesha-amharic': { score: 0.58, rationale: 'opinion_heavier_outlet_with_mixed_editorial_signals' }
});

const tierFromScore = (score) => {
  if (score >= 0.85) {
    return 'high';
  }

  if (score >= 0.7) {
    return 'medium';
  }

  return 'low';
};

const normalizeScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric > 1 && numeric <= 100) {
    return clamp01(numeric / 100);
  }

  return clamp01(numeric);
};

export const normalizeSourceQuality = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const score = normalizeScore(value);
    if (score === null) {
      return null;
    }

    return {
      score,
      tier: tierFromScore(score),
      rationale: 'manual_score',
      strategyVersion: SOURCE_QUALITY_STRATEGY_VERSION,
      updatedAt: new Date()
    };
  }

  const score = normalizeScore(value.score ?? value.trustScore ?? value.qualityScore ?? value.rankScore);
  if (score === null) {
    return null;
  }

  return {
    score,
    tier: value.tier ?? tierFromScore(score),
    rationale: value.rationale ?? 'manual_score',
    strategyVersion: value.strategyVersion ?? SOURCE_QUALITY_STRATEGY_VERSION,
    updatedAt: value.updatedAt ? new Date(value.updatedAt) : new Date(),
    ...(value.isBackfilled !== undefined ? { isBackfilled: Boolean(value.isBackfilled) } : {})
  };
};

const defaultSourceQuality = ({ sourceSet, source }) => {
  if (sourceSet === 'candidate_sources') {
    return {
      score: 0.5,
      tier: 'low',
      rationale: 'candidate_default_pending_review',
      strategyVersion: SOURCE_QUALITY_STRATEGY_VERSION,
      updatedAt: new Date()
    };
  }

  const baseScore = source?.status === SOURCE_STATUS.ACTIVE ? 0.62 : 0.45;
  const rssBoost = source?.type === SOURCE_TYPES.RSS ? 0.03 : 0;
  const score = clamp01(baseScore + rssBoost);

  return {
    score,
    tier: tierFromScore(score),
    rationale: source?.status === SOURCE_STATUS.ACTIVE ? 'active_source_default' : 'inactive_source_default',
    strategyVersion: SOURCE_QUALITY_STRATEGY_VERSION,
    updatedAt: new Date()
  };
};

export const inferSourceQuality = ({ source, sourceSet = 'sources', existingQuality = null }) => {
  const normalizedExisting = normalizeSourceQuality(existingQuality ?? source?.sourceQuality);
  if (normalizedExisting) {
    return normalizedExisting;
  }

  const curated = CURATED_SOURCE_QUALITY_BY_SLUG[source?.slug];
  if (curated) {
    return {
      score: curated.score,
      tier: tierFromScore(curated.score),
      rationale: curated.rationale,
      strategyVersion: SOURCE_QUALITY_STRATEGY_VERSION,
      updatedAt: new Date(),
      isBackfilled: true
    };
  }

  return {
    ...defaultSourceQuality({ sourceSet, source }),
    isBackfilled: true
  };
};

export const resolveSourceQuality = ({ input, existing, sourceSet }) => {
  const explicitValue = input?.sourceQuality ?? input?.sourceQualityScore ?? input?.trustScore ?? input?.qualityScore;
  const explicit = normalizeSourceQuality(explicitValue);

  if (explicit) {
    if (input?.sourceQualityTier) {
      explicit.tier = input.sourceQualityTier;
    }

    if (input?.sourceQualityRationale) {
      explicit.rationale = String(input.sourceQualityRationale).trim();
    }

    return explicit;
  }

  const preserved = normalizeSourceQuality(existing?.sourceQuality);
  if (preserved) {
    return preserved;
  }

  return defaultSourceQuality({
    sourceSet,
    source: {
      ...existing,
      ...input
    }
  });
};
