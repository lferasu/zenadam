import { mergeTopicSignatures, overlapRatio } from '../utils/topicFingerprint.js';

const MAX_SUPPORTING_ARTICLES_CAP = 5;
const RECENCY_WINDOW_HOURS = 24;
const MIN_TOPIC_COHERENCE = 0.11;
const STRONG_MISMATCH_PENALTY = 0.2;
const PERSON_MATCH_BONUS_WEIGHT = 0.2;
const LOCATION_MATCH_BONUS_WEIGHT = 0.18;
const PERSON_LOCATION_STRONG_BONUS = 0.22;
const BROAD_STORY_SIMILARITY_FLOOR = 0.78;
const BROAD_STORY_COHERENCE_FLOOR = 0.12;
const BROAD_STORY_SCORE_FLOOR = 0.72;

const toDate = (value) => (value ? new Date(value) : new Date());

const buildArticleSignature = (article) => {
  const topicFingerprint = article?.topicFingerprint ?? {};

  return {
    keywords: topicFingerprint.keywords ?? article?.keywords ?? [],
    phrases: topicFingerprint.phrases ?? [],
    geographies: topicFingerprint.geographies ?? [],
    entities: topicFingerprint.entities ?? article?.entities ?? [],
    persons: topicFingerprint.persons ?? article?.persons ?? [],
    locations: topicFingerprint.locations ?? article?.locations ?? topicFingerprint.geographies ?? []
  };
};

const scoreTopicAlignment = (articleSignature, storySignature) => {
  const keywordOverlap = overlapRatio(articleSignature.keywords, storySignature.keywords);
  const phraseOverlap = overlapRatio(articleSignature.phrases, storySignature.phrases);
  const geographyOverlap = overlapRatio(articleSignature.geographies, storySignature.geographies);
  const entityOverlap = overlapRatio(articleSignature.entities, storySignature.entities);
  const personOverlap = overlapRatio(articleSignature.persons, storySignature.persons);
  const locationOverlap = overlapRatio(articleSignature.locations, storySignature.locations);

  const topicAgreementBonus = keywordOverlap * 0.12 + phraseOverlap * 0.12;
  const geographyAgreementBonus = geographyOverlap * 0.14;
  const entityOverlapBonus = entityOverlap * 0.1;
  const personOverlapBonus = personOverlap * PERSON_MATCH_BONUS_WEIGHT;
  const locationOverlapBonus = locationOverlap * LOCATION_MATCH_BONUS_WEIGHT;
  const broadContinuityBonus =
    keywordOverlap * 0.08 +
    phraseOverlap * 0.1 +
    entityOverlap * 0.08 +
    Math.max(personOverlap, locationOverlap) * 0.06;
  const strongPersonLocationBonus =
    personOverlap > 0 && locationOverlap > 0
      ? PERSON_LOCATION_STRONG_BONUS + Math.min(personOverlap, locationOverlap) * 0.06
      : 0;

  const geographyMismatchPenalty =
    articleSignature.geographies.length && storySignature.geographies.length && geographyOverlap === 0
      ? STRONG_MISMATCH_PENALTY
      : 0;
  const entityMismatchPenalty =
    articleSignature.entities.length && storySignature.entities.length && entityOverlap === 0
      ? 0.08
      : 0;
  const topicMismatchPenalty =
    articleSignature.keywords.length && storySignature.keywords.length && keywordOverlap < 0.2 && phraseOverlap === 0
      ? 0.04
      : 0;
  const personMismatchPenalty =
    articleSignature.persons.length && storySignature.persons.length && personOverlap === 0
      ? 0.04
      : 0;
  const locationMismatchPenalty =
    articleSignature.locations.length && storySignature.locations.length && locationOverlap === 0
      ? 0.04
      : 0;

  return {
    keywordOverlap,
    phraseOverlap,
    geographyOverlap,
    entityOverlap,
    personOverlap,
    locationOverlap,
    topicAgreementBonus,
    geographyAgreementBonus,
    entityOverlapBonus,
    personOverlapBonus,
    locationOverlapBonus,
    broadContinuityBonus,
    strongPersonLocationBonus,
    topicMismatchPenalty,
    geographyMismatchPenalty,
    entityMismatchPenalty,
    personMismatchPenalty,
    locationMismatchPenalty,
    topicCoherence:
      keywordOverlap * 0.16 +
      phraseOverlap * 0.14 +
      geographyOverlap * 0.12 +
      entityOverlap * 0.12 +
      personOverlap * 0.24 +
      locationOverlap * 0.22
  };
};

export const scoreStoryCandidate = ({ bestSimilarity, supportCount, recencyHours, articleSignature, storySignature }) => {
  const supportingArticlesBoost = Math.min(supportCount / MAX_SUPPORTING_ARTICLES_CAP, 1);
  const recencyBoost = Math.max(0, 1 - recencyHours / RECENCY_WINDOW_HOURS);
  const storyMemoryBonus = supportingArticlesBoost * 0.12 + (bestSimilarity >= BROAD_STORY_SIMILARITY_FLOOR ? 0.05 : 0);
  const topicAlignment = scoreTopicAlignment(articleSignature, storySignature);

  return {
    score:
      bestSimilarity * 0.5 +
      supportingArticlesBoost * 0.1 +
      recencyBoost * 0.05 +
      storyMemoryBonus +
      topicAlignment.topicAgreementBonus +
      topicAlignment.geographyAgreementBonus +
      topicAlignment.entityOverlapBonus +
      topicAlignment.personOverlapBonus +
      topicAlignment.locationOverlapBonus +
      topicAlignment.broadContinuityBonus +
      topicAlignment.strongPersonLocationBonus -
      topicAlignment.topicMismatchPenalty -
      topicAlignment.geographyMismatchPenalty -
      topicAlignment.entityMismatchPenalty -
      topicAlignment.personMismatchPenalty -
      topicAlignment.locationMismatchPenalty,
    supportingArticlesBoost,
    recencyBoost,
    storyMemoryBonus,
    ...topicAlignment
  };
};

export const meetsTopicCoherenceThreshold = (candidate) => {
  if (!candidate) {
    return false;
  }

  const hasHardEntitySignal = candidate.personOverlap > 0 || candidate.locationOverlap > 0;
  const hasBroadStorySignal =
    candidate.bestSimilarity >= BROAD_STORY_SIMILARITY_FLOOR &&
    candidate.topicCoherence >= BROAD_STORY_COHERENCE_FLOOR &&
    candidate.score >= BROAD_STORY_SCORE_FLOOR;

  if (candidate.geographyMismatchPenalty >= STRONG_MISMATCH_PENALTY && !hasBroadStorySignal) {
    return false;
  }

  if (candidate.topicCoherence < MIN_TOPIC_COHERENCE && !hasBroadStorySignal) {
    return false;
  }

  if (candidate.keywordOverlap === 0 && candidate.phraseOverlap === 0 && candidate.entityOverlap === 0 && candidate.geographyOverlap === 0) {
    return hasHardEntitySignal || hasBroadStorySignal;
  }

  return true;
};

export const evaluateStoryCandidates = (article, nearestCandidates) => {
  const grouped = new Map();
  const articleSignature = buildArticleSignature(article);

  for (const candidate of nearestCandidates) {
    if (!candidate.storyId) {
      continue;
    }

    const key = String(candidate.storyId);
    const current = grouped.get(key) ?? {
      storyId: key,
      similarities: [],
      latestCandidatePublishedAt: null,
      signatures: []
    };
    current.similarities.push(candidate.similarity);
    current.signatures.push(buildArticleSignature(candidate));

    if (!current.latestCandidatePublishedAt || new Date(candidate.publishedAt) > new Date(current.latestCandidatePublishedAt)) {
      current.latestCandidatePublishedAt = candidate.publishedAt;
    }

    grouped.set(key, current);
  }

  let best = null;

  for (const candidate of grouped.values()) {
    const bestSimilarity = Math.max(...candidate.similarities);
    const supportCount = candidate.similarities.length;
    const recencyHours =
      Math.abs(toDate(article.publishedAt).getTime() - toDate(candidate.latestCandidatePublishedAt).getTime()) /
      (1000 * 60 * 60);
    const storySignature = mergeTopicSignatures(candidate.signatures);

    const scoreBreakdown = scoreStoryCandidate({
      bestSimilarity,
      supportCount,
      recencyHours,
      articleSignature,
      storySignature
    });
    const scored = {
      storyId: candidate.storyId,
      bestSimilarity,
      supportCount,
      recencyHours,
      storySignature,
      ...scoreBreakdown
    };

    if (!best || scored.score > best.score) {
      best = scored;
    }
  }

  return best;
};

export const selectClusteringAction = ({ bestStory, strongThreshold }) => {
  if (bestStory && bestStory.score >= strongThreshold && meetsTopicCoherenceThreshold(bestStory)) {
    return 'attach';
  }

  return 'create';
};
