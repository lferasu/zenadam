export const buildNormalizedItemEmbeddingInput = (item = {}) => {
  const title = (item.normalizedTitle ?? item.title ?? '').trim();
  const detailedSummary = (item.normalizedDetailedSummary ?? '').trim();
  const keywords = Array.isArray(item.keywords) ? item.keywords.filter(Boolean).join(', ') : '';

  const hasRichContext = Boolean(detailedSummary || keywords);
  if (!hasRichContext) {
    return '';
  }

  return [title, detailedSummary, keywords ? `Keywords: ${keywords}` : ''].filter(Boolean).join('\n\n');
};
