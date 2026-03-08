import crypto from 'node:crypto';
import { normalizeText } from './text.js';

export const sha256 = (value = '') => {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

export const buildDedupeHash = ({ title = '', content = '', publishedAt = '' }) => {
  const normalizedTitle = normalizeText(title).toLowerCase();
  const normalizedContent = normalizeText(content).toLowerCase();
  const normalizedDate = publishedAt ? new Date(publishedAt).toISOString().slice(0, 10) : '';

  return sha256(`${normalizedDate}|${normalizedTitle}|${normalizedContent.slice(0, 400)}`);
};
