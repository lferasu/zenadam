# Incremental clustering (vector-first)

The backend clustering path is incremental and article-first:

1. normalize article
2. generate embedding (`title + snippet`)
3. retrieve nearest recent candidates
4. group candidates by `storyId`
5. compute best story score
6. attach to best story or create a new story

## Primary retrieval path: Atlas Vector Search

`normalized_items.embedding` is queried via `$vectorSearch` using the configured index.

Expected env vars:

- `VECTOR_SEARCH_ENABLED=true`
- `VECTOR_SEARCH_INDEX_NAME=normalized_item_embedding_index`
- `VECTOR_NUM_CANDIDATES=100`
- `CANDIDATE_WINDOW_HOURS=72`
- `CANDIDATE_FORWARD_WINDOW_HOURS=6`
- `MAX_NEAREST_ARTICLES=10`

If vector search is unavailable, the service falls back to the prior app-side candidate scan + cosine similarity path.

## Story-level threshold tuning

Story attach decisions are made on the computed story score (not raw cosine alone).

Recommended starting values:

- `SIMILARITY_STRONG_THRESHOLD=0.72`
- `SIMILARITY_BORDERLINE_THRESHOLD=0.70`

`CANDIDATE_FORWARD_WINDOW_HOURS` allows limited look-ahead so articles published slightly later can still be considered during matching.

## Atlas index example

Create an Atlas Vector Search index on collection `normalized_items`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 3072,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "publishedAt"
    }
  ]
}
```

`numDimensions` should match your embedding model output (for `text-embedding-3-large`, currently 3072).

## Backfill / migration notes

- Backfill embeddings for old `normalized_items` without `embedding` before enabling vector-first clustering in production.
- Existing stories created with old `clusterKey` flow can coexist temporarily; new incremental writes use `storyId` linkage on normalized items.
- Old records without `storyId` will be considered as candidates but only contribute to scoring after they are attached to a story.
- Keep legacy cluster-key flow only for manual backfills/compatibility; incremental clustering is the primary runtime path.
