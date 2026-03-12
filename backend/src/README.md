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
- `../docs/zenadam-mvp-api.postman_collection.json`: Postman collection for consumer and admin MVP APIs.
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

Consumer story feed endpoint for the MVP app.

Query params:

- `limit` (default `25`, max `100`)

Response `data` is a list of feed-ready stories containing:

- `id`, `title`, `summary`
- `sourceCount`
- `latestPublishedAt`, `updatedAt`
- `sourcePreview` (lightweight source-name preview when available)

Example:

```json
{
  "data": [
    {
      "id": "665f9d0e76f4871a7fcb4f03",
      "title": "Representative headline",
      "summary": "Story summary",
      "sourceCount": 4,
      "latestPublishedAt": "2026-02-16T11:20:00.000Z",
      "updatedAt": "2026-02-16T11:21:00.000Z",
      "sourcePreview": ["Reuters", "BBC"]
    }
  ],
  "meta": {
    "requestId": "b4f8...",
    "pagination": {
      "limit": 25,
      "count": 1
    }
  },
  "error": null
}
```

### GET `/stories/:storyId`

Returns one consumer-facing story for the story-detail screen.

Example:

```json
{
  "data": {
    "id": "665f9d0e76f4871a7fcb4f03",
    "title": "Representative headline",
    "summary": "Story summary",
    "sourceCount": 3,
    "articleCount": 4,
    "latestPublishedAt": "2026-02-16T11:20:00.000Z",
    "updatedAt": "2026-02-16T11:21:00.000Z",
    "articlePreviews": [
      {
        "id": "665f9cf676f4871a7fcb4eff",
        "title": "Newest article",
        "summary": "Normalized article summary",
        "snippet": "Normalized snippet",
        "sourceName": "Reuters",
        "canonicalUrl": "https://example.com/news/a",
        "publishedAt": "2026-02-16T11:20:00.000Z",
        "targetLanguage": "am"
      }
    ]
  },
  "meta": {
    "requestId": "b4f8..."
  },
  "error": null
}
```

### GET `/stories/:storyId/articles`

Returns the normalized/enriched articles for a selected story, ordered by `publishedAt DESC`.

Consumer article values come from normalized items, not raw source-item ingestion fields.

Example:

```json
{
  "data": {
    "storyId": "665f9d0e76f4871a7fcb4f03",
    "title": "Representative headline",
    "articleCount": 4,
    "articles": [
      {
        "id": "665f9cf676f4871a7fcb4eff",
        "storyId": "665f9d0e76f4871a7fcb4f03",
        "title": "Normalized article title",
        "summary": "Normalized detailed summary",
        "snippet": "Normalized snippet",
        "sourceName": "Reuters",
        "publishedAt": "2026-02-16T11:20:00.000Z",
        "canonicalUrl": "https://example.com/news/a",
        "targetLanguage": "am"
      }
    ]
  },
  "meta": {
    "requestId": "b4f8..."
  },
  "error": null
}
```

### GET `/stories/inspection`

Preserved read-only inspection endpoint for clustering validation.

Query params:

- `page` (default `1`)
- `limit` (default `25`, max `100`)
- `sort` (`recent` default, `created_desc`, `created_asc`, `article_count_desc`)
- `hasSummary` (`true`/`false`)
- `minArticleCount` (positive integer)

### GET `/stories/inspection/:id`

Preserved inspection detail endpoint.

Optional query param:

- `debug=true` to include stored clustering diagnostics

### GET `/admin/sources`

Admin source registry list endpoint.

Useful response fields include:

- `id`, `slug`, `name`, `type`
- `baseUrl`, `feedUrl`, `language`
- `isActive`
- `validationStatus`, `lastValidatedAt`, `lastValidationMessage`
- `createdAt`, `updatedAt`

### GET `/admin/sources/:sourceId`

Returns one configured source for admin edit/detail views.

### POST `/admin/sources/validate`

Validates a candidate source definition without saving it.

Validation flow:

- RSS/API sources: validate URL, fetch, parse, and confirm at least one item exists
- Scraper sources: validate URL, fetch page, confirm readable HTML for MVP

### POST `/admin/sources`

Creates a new source after server-side validation.

### PATCH `/admin/sources/:sourceId`

Updates an existing source and revalidates server-side before saving.

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

## Consumer/Admin API notes

- Consumer story/article endpoints return normalized/enriched values for product display.
- Raw source-item ingestion fields are not exposed directly in consumer article responses.
- Admin source management is intentionally limited to registry CRUD + validate-before-save for MVP.

## Clustering notes

- Embeddings now prefer `title + normalizedDetailedSummary`, then fall back to `title + snippet`, then bounded `content`, and finally `title` alone.
- Full raw article embedding is not the default because it adds cost, latency, and noise; the richer bounded source summary is the preferred middle ground.
- Retrieval remains vector-first, but scoring now adds dynamic topic-awareness from content-derived fingerprints (`keywords`, `phrases`, `geographies`, `entities`).
- Attach decisions require both semantic similarity and topic coherence, so broad conflict/politics overlap is less likely to merge unrelated stories.
