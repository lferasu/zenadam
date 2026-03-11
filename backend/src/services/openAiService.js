import { env } from '../config/env.js';

let openAiClientPromise;

export const getOpenAiClient = async () => {
  if (!openAiClientPromise) {
    openAiClientPromise = import('openai').then(({ default: OpenAI }) => {
      return new OpenAI({ apiKey: env.OPENAI_API_KEY });
    });
  }

  return openAiClientPromise;
};
