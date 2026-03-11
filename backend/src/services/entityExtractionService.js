import { env } from '../config/env.js';
import { normalizeText } from '../utils/text.js';
import { getOpenAiClient } from './openAiService.js';

const stripCodeFences = (value = '') =>
  value
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();

const parseJsonObject = (value = '') => {
  const cleaned = stripCodeFences(value);
  if (!cleaned) {
    return {};
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
};

const uniqueNormalized = (values = []) => {
  const seen = new Set();

  return values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const buildEntityExtractionPrompt = ({ text, language }) => ({
  system: [
    'Extract named entities for news clustering.',
    'Return JSON only.',
    'Schema: {"persons":["..."],"locations":["..."]}.',
    'Use canonical surface forms found in the article.',
    'Only include explicit people and explicit places mentioned in the text.',
    'Locations may include country, region, city, district, or locality.',
    'Do not infer entities that are not stated.'
  ].join(' '),
  user: JSON.stringify({
    language,
    text: text.slice(0, 4000)
  })
});

export const extractTypedEntities = async ({
  text = '',
  language = '',
  model = env.ZENADAM_ENTITY_EXTRACTION_MODEL
} = {}) => {
  const input = normalizeText(text);
  if (!input || !env.OPENAI_API_KEY || !model) {
    return { persons: [], locations: [] };
  }

  const client = await getOpenAiClient();
  const prompt = buildEntityExtractionPrompt({ text: input, language });
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ]
  });

  const payload = parseJsonObject(response.choices?.[0]?.message?.content ?? '');
  return {
    persons: uniqueNormalized(payload.persons),
    locations: uniqueNormalized(payload.locations)
  };
};

export const mergeTypedEntities = (...entitySets) => {
  const merged = entitySets.filter(Boolean);

  return {
    persons: uniqueNormalized(merged.flatMap((item) => item.persons ?? [])),
    locations: uniqueNormalized(merged.flatMap((item) => item.locations ?? []))
  };
};
