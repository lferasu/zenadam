# Zenadam MVP Backend (BBC Amharic Source-to-Feed Slice)

JavaScript monorepo for the Zenadam MVP backend, including a working source-to-feed slice for BBC Amharic RSS ingestion.

## Repository structure

```text
zenadam/
  apps/
    mobile/                      # React Native app (future)
    web/                         # Web app (future)
    admin/                       # Admin frontend (future)
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
  docs/
    zenadam-mvp-technical-spec.md
  .env.example
```

## Implemented capabilities

- Express API bootstrap with shared JSON envelope shape.
- Health route at `GET /api/v1/health`.
- Feed route at `GET /api/v1/feed` with optional `?limit=<n>`.
- Default source seeding for `bbc-amharic`.
- RSS ingestion for BBC Amharic feed entries.
- Normalization + story clustering pipeline to produce feed-ready stories.
- Worker entrypoints:
  - `npm run worker`
  - `npm run worker:ingestion`
  - `npm run worker:ai`
  - `npm run worker:seed`
  - `npm run worker:normalize`
  - `npm run worker:cluster`
  - `npm run worker:pipeline`
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
4. Seed the default source:
   ```bash
   npm run seed:sources
   ```
5. Run one ingestion pass:
   ```bash
   npm run ingest:rss
   ```
6. Build stories from ingested items:
   ```bash
   npm run pipeline
   ```
7. Check health:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
8. Fetch feed stories:
   ```bash
   curl 'http://localhost:3000/api/v1/feed?limit=10'
   ```

## Next implementation phases

- Multi-source onboarding/admin APIs.
- Additional ingestion connectors (API/scraper beyond the current RSS slice).
- AI pipeline modules (translation/summarization/embeddings).
- Story ranking and personalization layers.
