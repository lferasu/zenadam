import { buildDedupeHash } from '../utils/hash.js';
import { normalizeText, pickKeywords } from '../utils/text.js';
import { buildTopicFingerprint } from '../utils/topicFingerprint.js';
import { extractTypedEntities, mergeTypedEntities } from './entityExtractionService.js';
import { detectLanguage } from './languageDetectionService.js';
import { buildDetailedSummary } from './summaryGenerationService.js';
import { translateStructuredSummary, translateText } from './translationService.js';
import { buildNormalizedItemEmbeddingInput } from './embeddingInputBuilder.js';

const toSnippet = (summary, normalizedTitle) => normalizeText(summary).slice(0, 280) || normalizedTitle;

const uniqueKeywords = (fingerprintKeywords, title, content) => {
  return [...new Set([...(fingerprintKeywords ?? []), ...pickKeywords(title, content)])].slice(0, 8);
};

export const buildSourceItemEnrichment = async (item, { targetLanguage, deps = {} }) => {
  const detect = deps.detectLanguage ?? detectLanguage;
  const summarize = deps.buildDetailedSummary ?? buildDetailedSummary;
  const translate = deps.translateText ?? translateText;
  const translateStructured = deps.translateStructuredSummary ?? translateStructuredSummary;
  const extractEntities = deps.extractTypedEntities ?? extractTypedEntities;
  const mergeEntities = deps.mergeTypedEntities ?? mergeTypedEntities;
  const buildFingerprint = deps.buildTopicFingerprint ?? buildTopicFingerprint;
  const dedupeHashBuilder = deps.buildDedupeHash ?? buildDedupeHash;
  const buildEmbeddingInput = deps.buildNormalizedItemEmbeddingInput ?? buildNormalizedItemEmbeddingInput;
  const titleOriginal = normalizeText(item.title || '');
  const contentOriginal = normalizeText(item.rawText || item.title || '');
  const sourceLanguage = detect(`${titleOriginal} ${contentOriginal}`);

  const draftTitle = titleOriginal || contentOriginal.slice(0, 160) || 'Untitled source item';
  const draftSummary = summarize({ title: draftTitle, body: contentOriginal, targetLanguage: sourceLanguage });

  const [normalizedTitle, normalizedDetailedSummary, structuredSummary] = await Promise.all([
    translate({ text: draftTitle, sourceLanguage, targetLanguage }),
    translate({ text: draftSummary.text, sourceLanguage, targetLanguage }),
    translateStructured({
      structuredSummary: draftSummary,
      sourceLanguage,
      targetLanguage
    })
  ]);
  const snippet = toSnippet(normalizedDetailedSummary, normalizedTitle);

  const [targetLanguageEntities, sourceLanguageEntities] = await Promise.all([
    extractEntities({
      text: [normalizedTitle, normalizedDetailedSummary].filter(Boolean).join('\n\n'),
      language: targetLanguage
    }),
    extractEntities({
      text: [titleOriginal, contentOriginal].filter(Boolean).join('\n\n'),
      language: sourceLanguage
    })
  ]);

  const typedEntities = mergeEntities(targetLanguageEntities, sourceLanguageEntities);

  const topicFingerprint = buildFingerprint({
    title: normalizedTitle,
    detailedSummary: normalizedDetailedSummary,
    structuredSummary,
    content: normalizedDetailedSummary,
    snippet,
    typedEntities
  });

  const publishedAt = item.publishedAt ?? item.fetchedAt ?? null;

  const normalizedItem = {
    sourceItemId: item._id,
    sourceId: item.sourceId,
    canonicalUrl: item.url ?? null,
    sourceLanguage,
    targetLanguage,
    titleOriginal,
    contentOriginal,
    normalizedTitle,
    normalizedDetailedSummary,
    structuredSummary,
    title: normalizedTitle,
    snippet,
    content: normalizedDetailedSummary,
    language: targetLanguage,
    entities: topicFingerprint.entities,
    persons: topicFingerprint.persons,
    locations: topicFingerprint.locations,
    keywords: uniqueKeywords(topicFingerprint.keywords, normalizedTitle, normalizedDetailedSummary),
    topicFingerprint,
    publishedAt,
    dedupeHash: dedupeHashBuilder({
      title: normalizedTitle,
      content: normalizedDetailedSummary,
      publishedAt
    }),
    clusteringStatus: 'pending',
    enrichmentStatus: 'succeeded',
    enrichmentMetadata: {
      processedAt: new Date().toISOString(),
      sourceLanguage,
      targetLanguage,
      embeddingInputVersion: 'v1'
    }
  };

  normalizedItem.embeddingInput = buildEmbeddingInput(normalizedItem);

  return {
    sourceLanguage,
    targetLanguage,
    normalizedItem
  };
};
