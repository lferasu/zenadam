export const ingestApiSource = async (source) => {
  return {
    sourceId: source._id,
    sourceSlug: source.slug,
    sourceType: source.type,
    status: 'skipped',
    reason: 'API ingestion is not implemented yet.'
  };
};
