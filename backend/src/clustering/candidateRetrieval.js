const toFiniteSimilarity = (value) => {
  const similarity = Number(value);
  return Number.isFinite(similarity) ? similarity : 0;
};

export const createCandidateRetrieval = ({ deps, env, logger }) => {
  const getFallbackNearestCandidates = async (article, embedding) => {
    const candidates = await deps.findRecentCandidateArticles(article, {
      candidateWindowHours: env.CANDIDATE_WINDOW_HOURS,
      candidateForwardWindowHours: env.CANDIDATE_FORWARD_WINDOW_HOURS,
      maxCandidateArticles: env.MAX_CANDIDATE_ARTICLES
    });

    const nearestCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        similarity: deps.cosineSimilarity(embedding, candidate.embedding)
      }))
      .filter((candidate) => candidate.similarity >= env.SIMILARITY_BORDERLINE_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, env.MAX_NEAREST_ARTICLES);

    return { candidates, nearestCandidates };
  };

  const getVectorNearestCandidates = async (article, embedding) => {
    return deps.findNearestCandidateArticlesByVector({
      articleId: article._id,
      embedding,
      publishedAt: article.publishedAt,
      candidateWindowHours: env.CANDIDATE_WINDOW_HOURS,
      candidateForwardWindowHours: env.CANDIDATE_FORWARD_WINDOW_HOURS,
      limit: env.MAX_NEAREST_ARTICLES,
      numCandidates: env.VECTOR_NUM_CANDIDATES,
      indexName: env.VECTOR_SEARCH_INDEX_NAME
    });
  };

  const retrieveNearestCandidates = async (article, embedding) => {
    if (env.VECTOR_SEARCH_ENABLED) {
      try {
        logger.info('Executing vector search for incremental clustering', {
          normalizedItemId: String(article._id),
          vectorIndexName: env.VECTOR_SEARCH_INDEX_NAME,
          vectorNumCandidates: env.VECTOR_NUM_CANDIDATES,
          nearestLimit: env.MAX_NEAREST_ARTICLES,
          candidateWindowHours: env.CANDIDATE_WINDOW_HOURS
        });

        const vectorCandidates = await getVectorNearestCandidates(article, embedding);
        const nearestCandidates = vectorCandidates
          .map((candidate) => ({ ...candidate, similarity: toFiniteSimilarity(candidate.similarity) }))
          .filter((candidate) => candidate.similarity >= env.SIMILARITY_BORDERLINE_THRESHOLD)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, env.MAX_NEAREST_ARTICLES);

        logger.info('Vector search candidate retrieval completed', {
          normalizedItemId: String(article._id),
          candidateCount: vectorCandidates.length,
          nearestCount: nearestCandidates.length,
          topSimilarities: nearestCandidates.slice(0, 3).map((item) => Number(item.similarity.toFixed(4)))
        });

        return {
          lookupMethod: 'vector_search',
          nearestCandidates
        };
      } catch (error) {
        logger.warn('Vector search unavailable, falling back to recent-scan cosine flow', {
          normalizedItemId: String(article._id),
          message: error.message
        });
      }
    } else {
      logger.info('Vector search disabled via env; using fallback cosine scan', {
        normalizedItemId: String(article._id)
      });
    }

    const { candidates, nearestCandidates } = await getFallbackNearestCandidates(article, embedding);
    logger.info('Fallback candidate retrieval completed', {
      normalizedItemId: String(article._id),
      candidateCount: candidates.length,
      nearestCount: nearestCandidates.length,
      topSimilarities: nearestCandidates.slice(0, 3).map((item) => Number(item.similarity.toFixed(4)))
    });

    return {
      lookupMethod: 'recent_scan_fallback',
      nearestCandidates
    };
  };

  return {
    retrieveNearestCandidates
  };
};
