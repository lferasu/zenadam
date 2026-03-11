import { normalizeText } from '../utils/text.js';

const MIN_BULLETS = 3;
const MAX_BULLETS = 5;
const MAX_DETAIL_SENTENCES = 12;
const MIN_PARAGRAPH_WORDS = 120;

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

const shorten = (text = '', limit = 220) => {
  if (!text || text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
};

export const buildDetailedSummary = ({ title = '', body = '', targetLanguage = 'am' }) => {
  const normalizedBody = normalizeText(body);
  const sentences = uniqueStrings(sentenceSplit(normalizedBody));

  const candidates = uniqueStrings([...sentences, ...sentences.flatMap((sentence) => clauseSplit(sentence)), title]).filter(Boolean);
  const bullets = candidates.slice(0, MAX_BULLETS).map((candidate) => shorten(cleanBullet(candidate), 220));

  const normalizedBullets = bullets.slice(0, Math.max(MIN_BULLETS, Math.min(MAX_BULLETS, bullets.length)));

  let paragraph = sentences.slice(0, MAX_DETAIL_SENTENCES).join(' ').trim();
  if (!paragraph) {
    paragraph =
      targetLanguage === 'am'
        ? `ይህ ንጥል መረጃ ስለ ${title || 'ዜናው'} ተጨማሪ ዝርዝር አልያዘም።`
        : `This source item does not provide enough article body text beyond ${title || 'the headline'}.`;
  }

  if (countWords(paragraph) < MIN_PARAGRAPH_WORDS && normalizedBody) {
    paragraph = normalizedBody;
  }

  const heading = targetLanguage === 'am' ? 'ዝርዝር ማጠቃለያ፡' : 'Detailed summary:';
  const paragraphLabel = targetLanguage === 'am' ? 'ተጨማሪ ማብራሪያ፡' : 'Expanded detail:';
  const bulletSection = normalizedBullets.map((bullet) => `- ${bullet}`).join('\n');

  return {
    bullets: normalizedBullets,
    paragraph,
    text: [heading, bulletSection, '', `${paragraphLabel} ${paragraph}`].filter(Boolean).join('\n')
  };
};
