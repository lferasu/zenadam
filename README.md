# Zenadam

JavaScript monorepo for the Zenadam backend and the first admin UI iteration for source management.

## Repository structure

```text
zenadam/
  backend/
    package.json
    src/
      api/
        middlewares/
        routes/
      controllers/
      services/
      models/
      repositories/
      ingestion/
        rss/
        api/
        scraper/
      ai/
      clustering/
      ranking/
      translation/
      summarization/
      embeddings/
      workers/
      admin/
      config/
      utils/
      app.js
      server.js
    tests/
      unit/
      integration/
    scripts/
    deployment/
      render.yaml
  admin/
    app/
    components/
    hooks/
    lib/
    services/
    package.json
  docs/
  .env.example
  README.md
```

## Implemented capabilities

- Express API bootstrap with shared JSON envelope shape.
- Top-level Next.js admin UI at `admin/` for mobile-first source management.
- Health route at `GET /api/v1/health`.
- Feed route at `GET /api/v1/feed` with optional `?limit=<n>`.
- Combined admin source listing across `sources` and `candidate_sources`.
- Candidate-source create/update APIs that save to `candidate_sources` even when validation reports warnings or failures.
- Source-type ingestion dispatch (`rss`, `scraper`, `api`) with RSS fully implemented.
- Default source seeding script for `bbc-amharic`.
- RSS ingestion for configured active feed sources.
- Normalization + story clustering pipeline to produce feed-ready stories.
- Source audit tooling (RSS + scraper health checks, JSON report output).
- Source prune tooling (dry-run/apply removal of failed sources).
- Story reconciliation tooling (dry-run/apply merge for fragmented one-item stories).
- Worker entrypoints:
  - `npm run worker`
  - `npm run worker:ingestion`
  - `npm run worker:ai`
  - `npm run worker:seed`
  - `npm run worker:normalize`
  - `npm run worker:cluster`
  - `npm run worker:pipeline`
  - `npm run audit:sources`
  - `npm run prune:sources`
  - `npm run reconcile:stories`
  - `npm run cron`
- Render deployment template for API + worker + cron.
- Environment variable contract in `.env.example`.

## Local start

1. Copy and edit env vars:
   ```bash
   cp .env.example .env
   ```
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Run API server:
   ```bash
   npm run dev
   ```
4. In a second terminal, install admin dependencies:
   ```bash
   cd admin
   npm install
   ```
5. Start the admin UI:
   ```bash
   npm run dev
   ```
6. Seed the default source:
   ```bash
   cd ../backend
   npm run seed:sources
   ```
7. Run one ingestion pass:
   ```bash
   npm run ingest:rss
   ```
8. Build stories from ingested items:
   ```bash
   npm run pipeline
   ```
9. Audit active sources:
   ```bash
   npm run audit:sources
   ```
10. Dry-run prune failed sources:
   ```bash
   npm run prune:sources
   ```
11. Dry-run story reconciliation:
   ```bash
   npm run reconcile:stories
   ```
12. Check health:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
13. Fetch feed stories:
   ```bash
   curl 'http://localhost:3000/api/v1/feed?limit=10'
   ```
14. Open the admin UI:
    ```bash
    http://localhost:3001/sources
    ```

## Operational docs

- `backend/docs/ingestion-architecture.md`
- `backend/docs/source-audit.md`
- `backend/docs/source-prune.md`
- `backend/docs/incremental-clustering.md`
- `backend/docs/story-reconciliation.md`
- `backend/examples/source-configs.json`

## Next implementation phases

- Multi-source onboarding/admin APIs.
- Additional ingestion connectors (API/scraper beyond the current RSS slice).
- AI pipeline modules (translation/summarization/embeddings).
- Story ranking and personalization layers.
