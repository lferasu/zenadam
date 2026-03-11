import { env } from '../config/env.js';
import { getOpenAiClient } from './openAiService.js';

export const buildArticleEmbedding = (article) => {
  const title = (article?.title ?? '').trim();
  const normalizedDetailedSummary = (article?.normalizedDetailedSummary ?? '').trim();
  const snippet = (article?.snippet ?? '').trim();
  const content = (article?.content ?? '').trim();
  const boundedContent = content ? content.slice(0, 800).trim() : '';

  const detail = normalizedDetailedSummary || snippet || boundedContent;

  if (!detail) {
    return title;
  }

  return `${title}\n\n${detail}`;
};

export const generateEmbedding = async (text) => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const input = (text ?? '').trim();
  if (!input) {
    return [];
  }

  const client = await getOpenAiClient();
  const response = await client.embeddings.create({
    model: env.ZENADAM_EMBEDDING_MODEL,
    input
  });

  return response.data?.[0]?.embedding ?? [];
};

export const cosineSimilarity = (vecA = [], vecB = []) => {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};
