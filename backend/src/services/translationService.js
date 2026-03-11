import { env } from '../config/env.js';
import { getOpenAiClient } from './openAiService.js';

const requireTranslationConfig = () => {
  if (!env.OPENAI_API_KEY) {
    const error = new Error('Translation required but OPENAI_API_KEY is not configured');
    error.code = 'TRANSLATION_CONFIG_MISSING';
    throw error;
  }
};

export const translateText = async ({ text, sourceLanguage, targetLanguage }) => {
  const input = (text ?? '').trim();
  if (!input || sourceLanguage === targetLanguage) {
    return input;
  }

  requireTranslationConfig();

  const client = await getOpenAiClient();
  const response = await client.responses.create({
    model: env.AI_TRANSLATION_MODEL || 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content: `Translate user-provided text from ${sourceLanguage} to ${targetLanguage}. Return only the translated text.`
      },
      {
        role: 'user',
        content: input
      }
    ]
  });

  const translated = response.output_text?.trim();
  if (!translated) {
    throw new Error('Translation model returned empty output');
  }

  return translated;
};

export const translateStructuredSummary = async ({ structuredSummary, sourceLanguage, targetLanguage }) => {
  if (sourceLanguage === targetLanguage) {
    return structuredSummary;
  }

  const bullets = await Promise.all(
    (structuredSummary?.bullets ?? []).map((bullet) =>
      translateText({
        text: bullet,
        sourceLanguage,
        targetLanguage
      })
    )
  );

  const paragraph = await translateText({
    text: structuredSummary?.paragraph ?? '',
    sourceLanguage,
    targetLanguage
  });

  return { bullets, paragraph };
};
