import { load as loadHtml } from 'cheerio';
import { env } from '../config/env.js';
import { normalizeText } from '../utils/text.js';

const AMHARIC_REGEX = /[\u1200-\u137F]/;
const MIN_BULLETS = 3;
const MAX_BULLETS = 5;
const MIN_PARAGRAPH_WORDS = 120;
const MAX_DETAIL_SENTENCES = 12;
const MIN_SOURCE_BODY_WORDS = 90;
const ARTICLE_FETCH_TIMEOUT_MS = 12000;

export const detectLanguage = (text = '') => {
  if (AMHARIC_REGEX.test(text)) {
    return 'am';
  }

  return 'en';
};

const sentenceSplit = (text = '') =>
  text
    .split(/(?<=[.!?\u1362])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

const clauseSplit = (text = '') =>
  text
    .split(/[;,:]\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24);

const shorten = (text = '', limit = 180) => {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
};

const shortenParagraph = (text = '', limit = 1600) => {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
};

const countWords = (text = '') => text.split(/\s+/u).filter(Boolean).length;

const uniqueStrings = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalizeText(item).toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const cleanBullet = (text = '') => text.replace(/[.!?\u1362]+$/u, '').trim();

const extractTextWithSelectors = ($, selectors = []) => {
  const chunks = [];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = normalizeText($(element).text());
      if (text.length >= 40) {
        chunks.push(text);
      }
    });
  }

  return uniqueStrings(chunks).join(' ');
};

const fetchExpandedArticleBody = async (url) => {
  if (!url) {
    return '';
  }

  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'ZenadamBot/0.1 (+https://zenadam.local)'
      },
      signal: AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    const $ = loadHtml(html);

    const selectorGroups = [
      ['main article p', 'article p'],
      ['main [data-component="text-block"] p', 'main [data-component="text-block"]'],
      ['main [property="articleBody"] p', '[property="articleBody"] p'],
      ['main p'],
      ['p']
    ];

    for (const selectors of selectorGroups) {
      const extracted = extractTextWithSelectors($, selectors);
      if (countWords(extracted) >= MIN_PARAGRAPH_WORDS) {
        return extracted;
      }
    }
  } catch {
    return '';
  }

  return '';
};

const buildBulletPoints = ({ title, sentences }) => {
  const candidates = uniqueStrings([
    ...sentences,
    ...sentences.flatMap((sentence) => clauseSplit(sentence)),
    title
  ]).filter(Boolean);

  const bullets = [];

  for (const candidate of candidates) {
    const bullet = shorten(cleanBullet(candidate), 220);
    if (!bullet) {
      continue;
    }

    bullets.push(bullet);
    if (bullets.length === MAX_BULLETS) {
      break;
    }
  }

  return bullets.slice(0, Math.max(MIN_BULLETS, Math.min(MAX_BULLETS, bullets.length)));
};

const buildParagraph = ({ title, body, sentences, targetLanguage }) => {
  const paragraphSentences = [];

  for (const sentence of sentences.slice(0, MAX_DETAIL_SENTENCES)) {
    paragraphSentences.push(sentence);
    if (countWords(paragraphSentences.join(' ')) >= MIN_PARAGRAPH_WORDS) {
      break;
    }
  }

  let paragraph = paragraphSentences.join(' ').trim();

  if (!paragraph) {
    return targetLanguage === 'am'
      ? `ይህ ንጥል መረጃ ስለ ${title || 'ዜናው'} ተጨማሪ ዝርዝር አልያዘም።`
      : `This source item does not provide enough article body text beyond ${title || 'the headline'}.`;
  }

  if (countWords(paragraph) < MIN_PARAGRAPH_WORDS && body) {
    paragraph = body;
  }

  return shortenParagraph(paragraph, 1600);
};

const buildDetailedSummary = ({ title, body, targetLanguage }) => {
  const normalizedBody = normalizeText(body);
  const sentences = uniqueStrings(sentenceSplit(normalizedBody));
  const bullets = buildBulletPoints({ title, sentences });
  const paragraph = buildParagraph({ title, body: normalizedBody, sentences, targetLanguage });

  const heading = targetLanguage === 'am' ? 'ዝርዝር ማጠቃለያ፡' : 'Detailed summary:';
  const paragraphLabel = targetLanguage === 'am' ? 'ተጨማሪ ማብራሪያ፡' : 'Expanded detail:';
  const bulletSection = bullets.map((bullet) => `- ${bullet}`).join('\n');
  const text = [heading, bulletSection, '', `${paragraphLabel} ${paragraph}`].filter(Boolean).join('\n');

  return {
    bullets,
    paragraph,
    text: shortenParagraph(text, 2200)
  };
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

export const generateSourceItemNormalization = async ({
  title = '',
  body = '',
  url = '',
  targetLanguage = env.ZENADAM_TARGET_LANGUAGE
}) => {
  let resolvedBody = normalizeText(body);

  if (countWords(resolvedBody) < MIN_SOURCE_BODY_WORDS) {
    const fetchedBody = await fetchExpandedArticleBody(url);
    if (countWords(fetchedBody) > countWords(resolvedBody)) {
      resolvedBody = fetchedBody;
    }
  }

  const rawText = normalizeText(`${title} ${resolvedBody}`);
  const sourceLanguage = detectLanguage(rawText);
  const normalizedTitle = buildNormalizedTitle({ title, body: resolvedBody, targetLanguage });

  // Source-item detail must stay richer than story-level synthesis:
  // bullets provide scanability, the paragraph carries the deeper article-specific context.
  const detail = buildDetailedSummary({
    title: normalizedTitle,
    body: resolvedBody,
    targetLanguage
  });

  return {
    sourceLanguage,
    targetLanguage,
    normalizedTitle,
    normalizedDetailedSummary: detail.text,
    normalizedDetailedSummaryStructured: {
      bullets: detail.bullets,
      paragraph: detail.paragraph
    }
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
