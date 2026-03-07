# Zenadam MVP Repository Skeleton

Implementation-ready JavaScript monorepo skeleton for the Zenadam MVP backend platform.

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

## Included starter capabilities

- Express API bootstrap with shared JSON envelope shape.
- Health route at `GET /api/v1/health`.
- Worker entrypoints:
  - `npm run worker`
  - `npm run worker:ingestion`
  - `npm run worker:ai`
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
4. Check health:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```

## Next implementation phases

- Source onboarding/admin APIs.
- Ingestion connectors (RSS/API/scraper) + normalization.
- AI pipeline modules (translation/summarization/embeddings).
- Story clustering, ranking, and feed APIs.
