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
