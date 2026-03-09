import { env } from '../config/env.js';

let openAiClientPromise;

const getOpenAiClient = async () => {
  if (!openAiClientPromise) {
    openAiClientPromise = import('openai').then(({ default: OpenAI }) => {
      return new OpenAI({ apiKey: env.OPENAI_API_KEY });
    });
  }

  return openAiClientPromise;
};

export const buildArticleEmbedding = (article) => {
  const title = (article?.title ?? '').trim();
  const snippet = (article?.snippet ?? '').trim();

  if (!snippet) {
    return title;
  }

  return `${title}\n\n${snippet}`;
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
