# Ingestion architecture

The ingestion layer is now source-type driven and config-first.

## Flow

1. Worker (`src/workers/ingestion.worker.js`) triggers `ingestActiveSources()`.
2. Active sources are loaded from MongoDB (`status=active`, optionally filtered by `type`).
3. Each source is dispatched via `ingestSource(source)`.
4. `ingestSource` resolves a handler from `source.type` using `getIngestorForSourceType`.
5. Handler result is collected into run metrics and logged.

## Handler dispatch

Registry file: `src/ingestion/ingestorRegistry.js`

Supported handlers:

- `rss` → `ingestRssSource` (implemented)
- `scraper` → `ingestScraperSource` (placeholder)
- `api` → `ingestApiSource` (placeholder)

To add a new source type, implement an ingestor and register it in the map.

## RSS ingestor behavior

File: `src/ingestion/rss/rssIngestor.js`

### Reliability

- Iterates all `entryUrls` for each source.
- Per-feed try/catch isolation (one broken feed URL does not fail the source).
- Per-item try/catch isolation (bad items are skipped).
- Retry support in `fetchConfig`:
  - `timeoutMs`
  - `userAgent`
  - `headers`
  - `retries`
  - `retryDelayMs`
- Supports RSS and Atom XML.

### Field normalization

Handles common feed variations:

- title
- link or url
- guid or id
- pubDate / published / updated
- description / summary / content / content:encoded

Uses optional source config:

- `parserConfig.preferredContentField`
- `parserConfig.preferredDateField`
- `normalizationConfig.stripHtml`
- `normalizationConfig.summaryMaxLength`
- `normalizationConfig.titleCleanupRules`

### Deduplication

`upsertSourceItem` keeps dedupe key as `{ sourceId, externalId }`.

## Observability

At the end of each run, logs include:

- total sources processed
- sources succeeded / failed
- feeds succeeded / failed
- items fetched
- items inserted
- items skipped

## Seeding policy

Runtime ingestion no longer seeds sources.

Use the dedicated seed worker/script:

```bash
npm run worker:seed
# or
npm run seed:sources
```

## Add a new RSS source

1. Insert source config document into MongoDB `sources` collection.
2. Set `type: "rss"`, `status: "active"`, and one or more `entryUrls`.
3. Optionally tune fetch/parser/normalization config.
4. Run ingestion worker.

## Add a new source type

1. Create ingestor module with `ingest(source)`.
2. Register type in `SOURCE_TYPES`.
3. Add mapping in `ingestorRegistry.js`.
4. Add source docs/examples.
