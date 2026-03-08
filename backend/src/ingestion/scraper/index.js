export const ingestScraperSource = async (source) => {
  return {
    sourceId: source._id,
    sourceSlug: source.slug,
    sourceType: source.type,
    status: 'skipped',
    reason: 'Scraper ingestion is not implemented yet.'
  };
};
