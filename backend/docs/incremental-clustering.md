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
- `MAX_NEAREST_ARTICLES=10`

If vector search is unavailable, the service falls back to the prior app-side candidate scan + cosine similarity path.

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

### Backfill command (recommended rollout)

1. Keep vector search disabled during backfill:

```bash
VECTOR_SEARCH_ENABLED=false
```

2. Dry-run to estimate throughput/count:

```bash
cd backend
npm run backfill:embeddings -- --dry-run --batch-size=100 --limit=500
```

3. Run real backfill:

```bash
cd backend
npm run backfill:embeddings -- --batch-size=100
```

4. Resume from a checkpoint id if interrupted:

```bash
cd backend
npm run backfill:embeddings -- --batch-size=100 --from-id=<last_processed_object_id>
```

The script writes `embedding`, `embeddingModel`, and `embeddingCreatedAt` on `normalized_items` documents where embeddings are missing or empty.


- Backfill embeddings for old `normalized_items` without `embedding` before enabling vector-first clustering in production.
- Existing stories created with old `clusterKey` flow can coexist temporarily; new incremental writes use `storyId` linkage on normalized items.
- Old records without `storyId` will be considered as candidates but only contribute to scoring after they are attached to a story.
- Keep legacy cluster-key flow only for manual backfills/compatibility; incremental clustering is the primary runtime path.
