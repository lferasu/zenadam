import { normalizeText, pickKeywords, tokenizeTitle } from './text.js';

const GEO_MARKERS = [
  'ክልል',
  'ዞን',
  'ወረዳ',
  'ከተማ',
  'አገር',
  'ደሴት',
  'region',
  'zone',
  'district',
  'city',
  'country',
  'state',
  'province'
];

const ENTITY_ROLE_MARKERS = [
  'ፕሬዝዳንት',
  'ሚኒስትር',
  'ጠቅላይ',
  'ሠራዊት',
  'ገዳም',
  'መንግሥት',
  'president',
  'minister',
  'army',
  'government',
  'forces'
];

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'about',
  'after',
  'before',
  'በ',
  'እና',
  'የ',
  'ከ',
  'ወደ',
  'ላይ',
  'ሆኖ',
  'ነው',
  'ናቸው'
]);

const TOPIC_SIGNATURE_LIMIT = 8;

const uniqueStrings = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

const sentenceSplit = (text = '') =>
  normalizeText(text)
    .split(/(?<=[.!?\u1362])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

const tokenizeText = (text = '') =>
  tokenizeTitle(text).filter((token) => token.length >= 2 && !STOPWORDS.has(token));

const buildNgrams = (tokens = [], min = 2, max = 4) => {
  const results = [];

  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const slice = tokens.slice(index, index + size);
      if (slice.some((token) => STOPWORDS.has(token))) {
        continue;
      }

      results.push(slice.join(' '));
    }
  }

  return results;
};

const rankedPhrases = (texts = [], limit = TOPIC_SIGNATURE_LIMIT) => {
  const counts = new Map();

  for (const text of texts) {
    const ngrams = buildNgrams(tokenizeText(text));
    for (const phrase of ngrams) {
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([phrase]) => phrase);
};

const extractRegexPhrases = (text = '', regex) =>
  uniqueStrings(
    [...normalizeText(text).matchAll(regex)]
      .map((match) => match[1] ?? match[0])
      .map((value) => value.trim())
  );

const extractGeographies = (texts = []) => {
  const joined = texts.join(' ');
  const markerRegex = new RegExp(
    `((?:[\\p{L}\\p{N}"'“”]+\\s+){0,4}[\\p{L}\\p{N}"'“”]+\\s+(?:${GEO_MARKERS.join('|')}))`,
    'gu'
  );
  const prefixRegex = /(?:በ|ከ|ወደ|in|at|from)\s+((?:[\p{L}\p{N}"'“”]+\s+){0,4}[\p{L}\p{N}"'“”]+)/gu;

  return uniqueStrings([
    ...extractRegexPhrases(joined, markerRegex),
    ...extractRegexPhrases(joined, prefixRegex).filter((phrase) =>
      GEO_MARKERS.some((marker) => phrase.includes(marker)) || phrase.split(/\s+/u).length <= 3
    )
  ]).slice(0, TOPIC_SIGNATURE_LIMIT);
};

const extractEntities = (texts = []) => {
  const joined = texts.join(' ');
  const roleRegex = new RegExp(
    `((?:${ENTITY_ROLE_MARKERS.join('|')})\\s+(?:[\\p{L}\\p{N}"'“”]+\\s*){1,4})`,
    'gu'
  );

  const quotedRegex = /["“]([^"”]{4,80})["”]/gu;

  return uniqueStrings([
    ...extractRegexPhrases(joined, roleRegex),
    ...extractRegexPhrases(joined, quotedRegex),
    ...rankedPhrases(texts, TOPIC_SIGNATURE_LIMIT).filter((phrase) =>
      phrase.split(/\s+/u).length >= 2 && phrase.length >= 8
    )
  ]).slice(0, TOPIC_SIGNATURE_LIMIT);
};

export const buildTopicFingerprint = ({
  title = '',
  detailedSummary = '',
  structuredSummary,
  content = '',
  snippet = '',
  typedEntities
} = {}) => {
  const paragraph = structuredSummary?.paragraph ?? '';
  const bullets = Array.isArray(structuredSummary?.bullets) ? structuredSummary.bullets : [];
  const texts = uniqueStrings([title, ...bullets, paragraph, detailedSummary, snippet, content]).filter(Boolean);
  const keywords = uniqueStrings(
    pickKeywords(title, [paragraph, snippet, content].filter(Boolean).join(' '), TOPIC_SIGNATURE_LIMIT)
  ).slice(0, TOPIC_SIGNATURE_LIMIT);
  const phrases = rankedPhrases(texts).slice(0, TOPIC_SIGNATURE_LIMIT);
  const geographies = extractGeographies(texts);
  const entities = extractEntities(texts);
  const persons = uniqueStrings(typedEntities?.persons ?? []).slice(0, TOPIC_SIGNATURE_LIMIT);
  const locations = uniqueStrings(typedEntities?.locations ?? []).slice(0, TOPIC_SIGNATURE_LIMIT);

  return {
    keywords,
    phrases,
    geographies,
    entities,
    persons,
    locations
  };
};

const mergeRanked = (signatures = [], key) => {
  const counts = new Map();

  for (const signature of signatures) {
    for (const value of signature?.[key] ?? []) {
      const normalized = normalizeText(value);
      if (!normalized) {
        continue;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, TOPIC_SIGNATURE_LIMIT)
    .map(([value]) => value);
};

export const mergeTopicSignatures = (...signatures) => {
  const valid = signatures.flat().filter(Boolean);

  return {
    keywords: mergeRanked(valid, 'keywords'),
    phrases: mergeRanked(valid, 'phrases'),
    geographies: mergeRanked(valid, 'geographies'),
    entities: mergeRanked(valid, 'entities'),
    persons: mergeRanked(valid, 'persons'),
    locations: mergeRanked(valid, 'locations')
  };
};

const toSet = (values = []) => new Set(values.map((value) => normalizeText(value).toLowerCase()).filter(Boolean));

export const overlapRatio = (left = [], right = []) => {
  const leftSet = toSet(left);
  const rightSet = toSet(right);

  if (!leftSet.size || !rightSet.size) {
    return 0;
  }

  let overlap = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(leftSet.size, rightSet.size);
};
