# Backend skeleton

This folder contains the backend scaffolding for the Zenadam MVP.

- `server.js`: API entrypoint.
- `workers/worker.js`: generic background worker entrypoint.
- `workers/cron.js`: cron entrypoint.
- Domain folders include placeholders for phased implementation.

- `../docs/ingestion-architecture.md`: ingestion dispatch architecture and extension guide.
- `../docs/source-audit.md`: source audit command, report format, and status interpretation.
- `../docs/source-prune.md`: prune failed sources (dry-run/apply).
- `../docs/story-reconciliation.md`: safe merge pass for fragmented singleton stories.
- `../examples/source-configs.json`: example source documents for rss/scraper/api.

## API endpoints

All endpoints are under `API_BASE_PATH` (default `/api/v1`) and return an envelope:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

### GET `/health`

Returns API health and request context.

### GET `/stories`

Read-only story inspection endpoint for clustering validation.

Query params:

- `page` (default `1`)
- `limit` (default `25`, max `100`)
- `sort` (`recent` default, `created_desc`, `created_asc`, `article_count_desc`)
- `hasSummary` (`true`/`false`)
- `minArticleCount` (positive integer)

Response `data` is a list of stories containing:

- `id`, `title`, `summary`
- `articleCount`
- `latestArticleAt`, `createdAt`
- `previewArticles` (up to 3 with `title`, `source`, `publishedAt`)

Example:

```json
{
  "data": [
    {
      "id": "665f9d0e76f4871a7fcb4f03",
      "title": "Representative headline",
      "summary": "Story summary",
      "articleCount": 4,
      "latestArticleAt": "2026-02-16T11:20:00.000Z",
      "createdAt": "2026-02-15T06:30:00.000Z",
      "previewArticles": [
        {
          "title": "Newest article",
          "source": "Reuters",
          "publishedAt": "2026-02-16T11:20:00.000Z"
        }
      ]
    }
  ],
  "meta": {
    "requestId": "b4f8...",
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  },
  "error": null
}
```

### GET `/stories/:id`

Returns full story details and all related articles ordered by `publishedAt DESC`.

Optional query param:

- `debug=true` to include safe clustering diagnostics already stored in normalized items (`clusteringScore`, `clusteringMetadata`) and story-level representative article id.

Example:

```json
{
  "data": {
    "id": "665f9d0e76f4871a7fcb4f03",
    "title": "Representative headline",
    "summary": "Story summary",
    "createdAt": "2026-02-15T06:30:00.000Z",
    "updatedAt": "2026-02-16T11:21:00.000Z",
    "articleCount": 4,
    "articles": [
      {
        "id": "665f9cf676f4871a7fcb4eff",
        "source": "Reuters",
        "sourceType": "rss",
        "title": "Newest article",
        "url": "https://example.com/news/a",
        "publishedAt": "2026-02-16T11:20:00.000Z",
        "language": "en",
        "createdAt": "2026-02-16T11:20:10.000Z",
        "debug": {
          "clusteringScore": 0.84,
          "clusteringMetadata": {
            "lookupMethod": "vector"
          }
        }
      }
    ],
    "debug": {
      "representativeArticleId": "665f9cf676f4871a7fcb4eff"
    }
  },
  "meta": {
    "requestId": "b4f8...",
    "debug": true
  },
  "error": null
}
```

## Normalization and story summary refresh

Zenadam keeps ingestion raw, then runs post-ingestion enrichment in two independent layers:

1. **Source item normalization/enrichment** (worker: `npm run worker:normalize`)
   - Detects `sourceLanguage`
   - Resolves `targetLanguage` from `ZENADAM_TARGET_LANGUAGE` (default `am`)
   - Persists `normalizedTitle` and `normalizedDetailedSummary` on each source item
   - When RSS body text is too thin, the normalizer may fetch the article URL to build a richer source-level summary from page content
   - `normalizedDetailedSummary` is intentionally richer than `storySummary`: 3-5 bullets first, then an expanded paragraph with deeper source-level context
   - Tracks status with `normalizationStatus` (`pending | processing | ready | failed`)

2. **Story summary refresh** (hooked to clustering)
   - On story creation and story attachment, refreshes story presentation fields in target language
   - Keeps `storySummary` as the shorter multi-source synthesis layer above the richer source-item detail
   - Persists `storyTitle`, `storySummary`, `targetLanguage`
   - Tracks status with `storySummaryStatus` (`pending | processing | ready | stale | failed`)

### New env vars

- `ZENADAM_TARGET_LANGUAGE=am`
- `ZENADAM_ENABLE_NORMALIZATION=true`
- `ZENADAM_ENABLE_STORY_SUMMARY_REFRESH=true`
- `ZENADAM_NORMALIZATION_BATCH_LIMIT=100`

### Local pipeline run

From `backend/`:

```bash
npm run worker:ingestion
npm run worker:normalize
npm run worker:cluster
```

Or run the full pass in one shot:

```bash
npm run worker:pipeline
```

To deploy in another product language, set `ZENADAM_TARGET_LANGUAGE` to that language code (for example `en`) without changing business logic.

## Clustering notes

- Embeddings now prefer `title + normalizedDetailedSummary`, then fall back to `title + snippet`, then bounded `content`, and finally `title` alone.
- Full raw article embedding is not the default because it adds cost, latency, and noise; the richer bounded source summary is the preferred middle ground.
- Retrieval remains vector-first, but scoring now adds dynamic topic-awareness from content-derived fingerprints (`keywords`, `phrases`, `geographies`, `entities`).
- Attach decisions require both semantic similarity and topic coherence, so broad conflict/politics overlap is less likely to merge unrelated stories.
