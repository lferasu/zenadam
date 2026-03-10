import { env } from '../config/env.js';
import { normalizeText } from '../utils/text.js';

const AMHARIC_REGEX = /[\u1200-\u137F]/;

export const detectLanguage = (text = '') => {
  if (AMHARIC_REGEX.test(text)) {
    return 'am';
  }

  return 'en';
};

const sentenceSplit = (text = '') =>
  text
    .split(/(?<=[.!?።])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

const shorten = (text = '', limit = 180) => {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
};

const buildDetailedSummary = ({ title, body, targetLanguage }) => {
  const sentences = sentenceSplit(body);
  const selected = sentences.slice(0, 4);

  if (!selected.length) {
    return targetLanguage === 'am'
      ? `ዝርዝር ማጠቃለያ፡ ${title || 'ይህ ንጥል መረጃ ርዕስ የለውም።'}`
      : `Detailed summary: ${title || 'Source item has no title.'}`;
  }

  if (targetLanguage === 'am') {
    return `ዝርዝር ማጠቃለያ፡ ${selected.join(' ')}`;
  }

  return `Detailed summary: ${selected.join(' ')}`;
};

const buildNormalizedTitle = ({ title, body, targetLanguage }) => {
  const normalizedTitle = normalizeText(title);
  if (normalizedTitle) {
    return shorten(normalizedTitle, 160);
  }

  const fallbackSentence = sentenceSplit(body)[0] ?? '';

  if (fallbackSentence) {
    return shorten(fallbackSentence, 160);
  }

  return targetLanguage === 'am' ? 'ያልተሰየመ የዜና ንጥል' : 'Untitled source item';
};

export const generateSourceItemNormalization = async ({ title = '', body = '', targetLanguage = env.ZENADAM_TARGET_LANGUAGE }) => {
  const rawText = normalizeText(`${title} ${body}`);
  const sourceLanguage = detectLanguage(rawText);
  const normalizedTitle = buildNormalizedTitle({ title, body, targetLanguage });
  const normalizedDetailedSummary = buildDetailedSummary({
    title: normalizedTitle,
    body: normalizeText(body),
    targetLanguage
  });

  return {
    sourceLanguage,
    targetLanguage,
    normalizedTitle,
    normalizedDetailedSummary
  };
};

export const generateStorySummary = async ({
  articles = [],
  targetLanguage = env.ZENADAM_TARGET_LANGUAGE
}) => {
  const articleTitles = articles.map((article) => normalizeText(article.title || '')).filter(Boolean);
  const fallbackTitle = targetLanguage === 'am' ? 'የተጠቃለለ ታሪክ' : 'Grouped story';
  const storyTitle = shorten(articleTitles[0] ?? fallbackTitle, 160);

  const summaryParts = articles
    .map((article) => normalizeText(article.snippet || article.content || ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => shorten(part, 220));

  const summaryPrefix = targetLanguage === 'am' ? 'ማጠቃለያ፡ ' : 'Summary: ';
  const storySummary = summaryParts.length
    ? `${summaryPrefix}${summaryParts.join(' ')}`
    : targetLanguage === 'am'
      ? 'ማጠቃለያ፡ በዚህ ታሪክ ላይ ተጨማሪ ዝርዝር ይገኛል።'
      : 'Summary: More details will be available as additional sources are clustered.';

  return {
    storyTitle,
    storySummary,
    targetLanguage
  };
};
