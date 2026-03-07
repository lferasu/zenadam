# Zenadam MVP Technical Specification

## 1. Product technical overview

Zenadam is an API-first news intelligence platform for Amharic-speaking users. The MVP ingests multi-source news (RSS, APIs, targeted scrapers), normalizes and enriches content with AI, clusters related articles into evolving **stories**, and serves ranked story feeds to mobile/web clients.

### Product principles (MVP)
- **Story-first UX**: Main feed shows stories, not raw articles.
- **Amharic-first output**: Summaries and translated content are delivered in Amharic wherever required.
- **Publisher-respecting model**: Zenadam offers summaries + source links; full reading happens on original publisher pages.
- **Backend as shared platform**: One REST backend serves mobile app, web app, and admin dashboard.
- **Operational simplicity**: Manual source onboarding, automated ingestion + enrichment.

### MVP client surfaces
- **Mobile app (React Native)**: primary user experience.
- **Web app (React/Next.js)**: secondary user experience with same API contract.
- **Admin dashboard**: internal source management + ingestion observability.

---

## 2. MVP scope vs future roadmap

### In scope for MVP
- Ingestion from RSS, selected APIs, and targeted scrapers.
- Manual source onboarding through admin dashboard.
- Language detection, translation-to-Amharic rules, summarization.
- Embedding generation + semantic story clustering.
- Story and article ranking (global, non-personalized).
- User interaction event collection for future personalization.
- Render deployment (API + worker + cron) + MongoDB Atlas.

### Explicitly out of scope for MVP
- Personalized ranking/recommendations.
- Social media ingestion.
- Region-grouped home feed sections.
- Complex moderation pipelines.
- Real-time websockets/push ranking updates.

### Near-term roadmap (post-MVP)
- Personalization engine using `userInteractions`.
- Source-level quality scoring from engagement + editorial review.
- Social feed connectors (Telegram, X, Facebook public pages).
- Multi-lingual output options (Amharic + English toggle).
- Improved Deep Dive timelines/entities.

---

## 3. System architecture

### High-level components
1. **REST API Service (Render Web Service)**
   - Auth (basic for MVP/admin), story/feed endpoints, admin endpoints.
   - Reads from MongoDB collections and returns JSON.
2. **Background Worker (Render Background Worker)**
   - Executes queued ingestion + AI processing jobs.
3. **Scheduled Poller (Render Cron Job)**
   - Triggers source polling and periodic ranking/summary refresh.
4. **MongoDB Atlas**
   - Primary document store + vector search for clustering.
5. **External AI providers**
   - Translation, summarization, embedding generation.

### Runtime flow
- Cron job enqueues ingestion tasks by source type.
- Workers ingest and normalize articles.
- Workers run AI pipeline stages asynchronously.
- Clustering service assigns/creates stories via vector similarity.
- Ranking service computes story hotness and article order.
- API serves precomputed story/article views with lightweight runtime filters.

### Synchronous vs async responsibilities
- **Synchronous (API request path):** reads, pagination, filtering, auth checks, lightweight response shaping.
- **Asynchronous (workers):** ingestion, translation, summarization, embeddings, clustering, ranking refresh, story summary refresh.

---

## 4. Ingestion pipeline design

### Source types
- `rss`
- `api`
- `scraper`

### Unified ingestion stages
1. **Fetch**: pull source payload (HTTP/XML/HTML/API JSON).
2. **Parse**: extract canonical fields (title, body, published time, url, author, media).
3. **Normalize**:
   - Canonical URL cleanup (remove tracking params).
   - Time normalization to UTC.
   - Hash generation (`contentHash`, `urlHash`) for de-dup.
4. **De-duplicate**:
   - Skip if same canonical URL already exists.
   - Soft-merge if near duplicate by title hash + source + timeframe.
5. **Persist raw + normalized article record** with processing state = `pending_ai`.
6. **Enqueue AI jobs**.

### Polling strategy
- Source-level interval (default 15 min, configurable by priority/source type).
- Backoff for failing sources with retry limits.
- Capture `lastSyncTime`, `errorStatus`, and `errorCount` on source.

### Failure handling
- Retry transient errors (network, 5xx).
- Mark source as `degraded` on repeated failures.
- Keep ingestion idempotent by source item GUID/url hash.

---

## 5. AI processing pipeline design

Each stage updates article/story processing metadata to support retries and observability.

1. **Language detection**
   - Determine `originalLanguage` from title + body.
2. **Translation decisioning**
   - Apply translation rules (Section 6).
3. **Article summarization**
   - Generate concise article summary.
4. **Feed summary generation**
   - Generate short feed card text for article-in-story list.
5. **Embedding generation**
   - Compute embedding from normalized headline + summary (+ key entities if available).
6. **Semantic clustering**
   - Match article into story or create new story.
7. **Story summary update**
   - Trigger periodic refresh when new influential article joins story.
8. **Ranking refresh signals**
   - Mark impacted stories for hotness recomputation.

### Processing state model (example)
- `ingested` -> `language_detected` -> `translated_or_skipped` -> `summarized` -> `embedded` -> `clustered` -> `ready`
- Failed stages store `lastError`, `retryCount`, `nextRetryAt`.

---

## 6. Translation pipeline design

### Translation rules (MVP)
1. **Amharic article** -> no translation; summarize in Amharic.
2. **English about Ethiopia** -> translate to Amharic.
3. **Horn of Africa news not in Amharic** -> translate to Amharic.
4. **Major world news not in Amharic** -> translate to Amharic.

### Practical decision engine
Use `shouldTranslate(article)` with:
- `originalLanguage`
- `regions` inferred from source metadata + NER/geotag heuristics
- category/topic tags (world/region/ethiopia)

### Stored fields
- `originalLanguage`
- `translatedLanguage` (typically `am`)
- `translatedTitle`
- `translatedBody`
- `translationProvider`
- `translationConfidence`

### MVP simplifications
- Single translation target (`am`).
- No user-language preferences.
- No sentence-level caching initially (can add later).

---

## 7. Story clustering strategy

### Core approach
- Use vector embeddings + metadata constraints.
- Primary match by cosine similarity in Atlas Vector Search.
- Add hard filters to avoid bad merges.

### Matching algorithm (MVP)
1. Query top-K nearest recent articles/stories by embedding.
2. Candidate stories are those with latest activity within configurable window (e.g., 7 days).
3. Compute composite score:
   - vector similarity (primary)
   - keyword overlap (secondary)
   - regional consistency bonus
4. If best score >= threshold (e.g., `0.82`) -> attach to existing story.
5. Else create new story.

### Evolution behavior
- Stories remain open while new related articles arrive.
- Inactivity timeout (e.g., 72h no updates) marks story as `cooling`.
- Story summary refresh when:
  - a high-credibility source joins,
  - significant new facts appear,
  - periodic refresh window reached.

---

## 8. Story hotness ranking strategy

MVP hotness should be deterministic, explainable, and cheap to recompute.

### Proposed formula

`hotness = (A * articleVolumeScore) + (B * sourceDiversityScore) + (C * recencyScore) + (D * regionalPriorityScore)`

Recommended weights (start point):
- `A = 0.30`
- `B = 0.20`
- `C = 0.35`
- `D = 0.15`

### Component definitions
- `articleVolumeScore`: min-max normalized article count in rolling 24h.
- `sourceDiversityScore`: unique source count in story (capped).
- `recencyScore`: exponential decay from most recent article timestamp.
- `regionalPriorityScore`:
  - Ethiopia = `1.0`
  - Horn of Africa = `0.7`
  - World = `0.5`

### Recompute cadence
- On story update event (new article attached).
- Scheduled global refresh every 15 minutes.

---

## 9. Feed ranking strategy inside a story

When viewing story details, rank article cards by informational usefulness.

### Proposed formula

`feedRank = (X * sourceCredibility) + (Y * recencyScore) + (Z * uniquenessScore)`

Suggested weights:
- `X = 0.40`
- `Y = 0.35`
- `Z = 0.25`

### Components
- `sourceCredibility`: admin-assigned score per source (MVP manual scale 0-1).
- `recencyScore`: decay from article publish time.
- `uniquenessScore`: novelty relative to existing story articles (embedding distance + keyphrase delta).

### MVP simplification
- Source credibility maintained manually in admin (no auto quality model yet).

---

## 10. MongoDB schema proposal

Collections required:
- `sources`
- `articles`
- `stories`
- `storyArticles`
- `userInteractions`

### `sources`
```json
{
  "_id": "ObjectId",
  "name": "string",
  "logoUrl": "string",
  "type": "rss|api|scraper",
  "baseUrl": "string",
  "language": "string",
  "region": "ethiopia|horn|world",
  "priority": 1,
  "credibilityScore": 0.8,
  "isActive": true,
  "pollIntervalMinutes": 15,
  "lastSyncTime": "date",
  "errorStatus": "none|degraded|failed",
  "errorCount": 0,
  "createdAt": "date",
  "updatedAt": "date"
}
```

### `articles`
```json
{
  "_id": "ObjectId",
  "sourceId": "ObjectId",
  "sourceArticleId": "string|null",
  "originalUrl": "string",
  "canonicalUrl": "string",
  "urlHash": "string",
  "title": "string",
  "body": "string",
  "publishedAt": "date",
  "ingestedAt": "date",
  "originalLanguage": "string",
  "translatedLanguage": "am|null",
  "translatedTitle": "string|null",
  "translatedBody": "string|null",
  "articleSummaryAm": "string",
  "feedSummaryAm": "string",
  "regions": ["ethiopia"],
  "topics": ["politics"],
  "embedding": [0.123],
  "processingState": "ready",
  "processingMeta": {
    "retryCount": 0,
    "lastError": null,
    "updatedAt": "date"
  },
  "createdAt": "date",
  "updatedAt": "date"
}
```

### `stories`
```json
{
  "_id": "ObjectId",
  "primaryRegion": "ethiopia|horn|world",
  "storySummaryAm": "string",
  "hotnessScore": 0.91,
  "articleCount": 12,
  "sourceCount": 6,
  "latestArticleAt": "date",
  "status": "active|cooling|closed",
  "clusterCentroidEmbedding": [0.456],
  "rankingMeta": {
    "articleVolumeScore": 0.8,
    "sourceDiversityScore": 0.7,
    "recencyScore": 0.9,
    "regionalPriorityScore": 1.0,
    "lastRankedAt": "date"
  },
  "summaryMeta": {
    "lastSummarizedAt": "date",
    "summaryVersion": 3
  },
  "createdAt": "date",
  "updatedAt": "date"
}
```

### `storyArticles`
```json
{
  "_id": "ObjectId",
  "storyId": "ObjectId",
  "articleId": "ObjectId",
  "similarityScore": 0.86,
  "feedRankScore": 0.78,
  "attachedAt": "date",
  "createdAt": "date"
}
```

### `userInteractions`
```json
{
  "_id": "ObjectId",
  "userId": "string|anonymous_device_id",
  "storyId": "ObjectId|null",
  "articleId": "ObjectId|null",
  "sourceId": "ObjectId|null",
  "interactionType": "story_opened|story_saved|source_muted",
  "metadata": {
    "platform": "ios|android|web",
    "sessionId": "string"
  },
  "createdAt": "date"
}
```

### Key indexes
- `sources`: `{ isActive: 1, type: 1 }`
- `articles`: unique `{ urlHash: 1 }`, plus `{ sourceId: 1, publishedAt: -1 }`, `{ processingState: 1 }`, `{ regions: 1, publishedAt: -1 }`
- `stories`: `{ hotnessScore: -1, latestArticleAt: -1 }`, `{ primaryRegion: 1, hotnessScore: -1 }`
- `storyArticles`: unique `{ storyId: 1, articleId: 1 }`, plus `{ storyId: 1, feedRankScore: -1 }`
- `userInteractions`: `{ userId: 1, createdAt: -1 }`, `{ interactionType: 1, createdAt: -1 }`

---

## 11. MongoDB Atlas Vector Search design

### Where vector search is used
1. **Story clustering**: find nearest existing story/article candidates for incoming article.
2. **Uniqueness scoring** inside story ranking: compare new article to story members.

### Vector index strategy
- Primary vector field: `articles.embedding`
- Optional second vector field later: `stories.clusterCentroidEmbedding`

### Atlas index example (conceptual)
- Index name: `article_embedding_idx`
- Path: `embedding`
- Similarity: cosine
- Dimensions: provider-dependent (e.g., 1024/1536)

### Query pattern
- `topK` candidates by vector similarity.
- Filter by recency window and optional region constraint.
- Threshold gate before attaching article to story.

### Operational notes
- Keep embedding model/version in metadata for migration safety.
- Re-embed in batches when changing embedding models.

---

## 12. REST API design

Base path: `/api/v1`

### Public/mobile/web endpoints
- `GET /health`
- `GET /stories?tab=feed|trending|deep-dive&cursor=...&limit=...`
- `GET /stories/:storyId`
- `GET /stories/:storyId/articles?cursor=...&limit=...`
- `POST /interactions`
- `GET /sources/:sourceId` (optional informational endpoint)

### Admin endpoints
- `GET /admin/sources`
- `POST /admin/sources`
- `PATCH /admin/sources/:sourceId`
- `POST /admin/sources/:sourceId/disable`
- `POST /admin/sources/:sourceId/enable`
- `GET /admin/sources/:sourceId/status`
- `GET /admin/jobs`

### Response conventions
- JSON only, with consistent envelope:
```json
{
  "data": {},
  "meta": {
    "requestId": "...",
    "cursor": "..."
  },
  "error": null
}
```

### API behavior notes
- Story list endpoints return only story-level data.
- Story details include ordered article/feed cards with source metadata.
- Original article opening should use client-side in-app browser with tracked click event.

---

## 13. Admin dashboard backend design

### Responsibilities
- Manual source management (CRUD-lite).
- Operational monitoring of source sync state and errors.
- Trigger/inspect ingestion jobs (read-only job list in MVP).

### Backend modules
- `admin/source.controller.js`
- `admin/source.service.js`
- `admin/source.repository.js`
- `admin/job.controller.js`

### Access control
- MVP: simple admin auth (single tenant, role = admin).
- Future: fine-grained roles and audit logs.

---

## 14. Deployment architecture

### Render services
1. **Web Service** (`zenadam-api`)
   - Runs Express REST API.
   - Health endpoint `/api/v1/health`.
2. **Background Worker** (`zenadam-worker`)
   - Runs worker process for queue consumers.
3. **Cron Job** (`zenadam-cron`)
   - Schedules polling and refresh jobs.

### Environment variables
- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `AI_API_KEY`
- `AI_EMBEDDING_MODEL`
- `AI_SUMMARY_MODEL`
- `AI_TRANSLATION_MODEL`
- `QUEUE_BACKEND` (for MVP can be Mongo-based queue)
- `JWT_SECRET` (if auth enabled)
- `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASS`

### Dev/staging/prod strategy
- **dev**: local docker-compose optional, shared dev Atlas cluster.
- **staging**: Render staging services + separate Atlas DB.
- **prod**: Render production services + production Atlas DB.

### CI readiness
- Run lint + tests on PR.
- Validate `render.yaml` and environment variable contract.
- Keep deployment scripts deterministic.

---

## 15. Suggested repository structure

```text
zenadam/
  apps/
    mobile/                      # React Native app (future)
    web/                         # Web app (future)
    admin/                       # Admin dashboard frontend
  backend/
    src/
      api/
        routes/
        middlewares/
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
    tests/
      unit/
      integration/
    scripts/
    deployment/
  docs/
    zenadam-mvp-technical-spec.md
```

This keeps backend-first delivery while reserving clear app workspaces.

---

## 16. Background worker design

### Worker types (logical queues)
- `ingestion-rss`
- `ingestion-api`
- `ingestion-scraper`
- `translation`
- `summarization`
- `embedding`
- `clustering`
- `story-ranking-refresh`
- `story-summary-refresh`

### Queue processing principles
- Idempotent jobs (safe retries).
- Explicit dead-letter handling for repeated failures.
- Per-source concurrency controls for scrapers.
- Metrics per queue: throughput, failures, retry rate, lag.

### Suggested execution pattern
- Poll job collection (or queue backend), claim with lease.
- Execute worker handler.
- Update job status and emit next-stage jobs.

---

## 17. Implementation phases

### Phase 0: Project bootstrap
- Repo scaffolding, env management, logging, health endpoint.
- Mongo connection + base models.
- Render deployment wiring.

### Phase 1: Source + ingestion foundation
- Admin source CRUD.
- RSS/API/scraper connectors with normalization + dedupe.
- Persist articles with processing states.

### Phase 2: AI enrichment
- Language detection + translation decisioning.
- Article/feed summaries.
- Embedding generation + storage.

### Phase 3: Story engine
- Clustering/matching logic + `storyArticles` relations.
- Story summary generation + refresh logic.
- Story and feed ranking computation.

### Phase 4: Public API for clients
- Feed/trending/deep-dive story endpoints.
- Story detail endpoints with ranked article cards.
- Interaction logging endpoint.

### Phase 5: Hardening + launch prep
- Observability dashboards/logging.
- Backoff/retry tuning, source error handling.
- CI checks and staging validation.

---

## 18. Risks / edge cases / MVP simplifications

### Key risks
- **Bad clustering merges** for related but distinct events.
- **Translation quality variance** for nuanced political content.
- **Scraper fragility** due to DOM changes.
- **Hotness gaming** by high-frequency low-value sources.
- **Latency spikes** if too much processing occurs synchronously.

### Mitigations
- Conservative cluster threshold + region/topic guards.
- Human-reviewable source credibility and source enable/disable.
- Async-first architecture with retries + DLQ.
- Ranking caps/normalization to limit one-source dominance.

### MVP simplifications (intentional)
- No personalization.
- No social ingestion.
- Manual source onboarding/credibility management.
- Limited auth model for admin.
- Batch-like periodic refreshes vs real-time streaming updates.

---

## Final recommended repository tree

```text
zenadam/
  .github/
    workflows/
      ci.yml
  apps/
    mobile/
      README.md
    web/
      README.md
    admin/
      README.md
  backend/
    package.json
    src/
      server.js
      app.js
      api/
        routes/
          index.js
          story.routes.js
          interaction.routes.js
          admin.sources.routes.js
      controllers/
        story.controller.js
        interaction.controller.js
      services/
        story.service.js
        interaction.service.js
      models/
        source.model.js
        article.model.js
        story.model.js
        storyArticle.model.js
        userInteraction.model.js
      repositories/
        source.repository.js
        article.repository.js
        story.repository.js
      ingestion/
        rss/
          rss.ingestor.js
        api/
          api.ingestor.js
        scraper/
          scraper.ingestor.js
      ai/
        ai-client.js
      clustering/
        story-cluster.service.js
      ranking/
        hotness.service.js
        feed-rank.service.js
      translation/
        translation.service.js
      summarization/
        summarization.service.js
      embeddings/
        embedding.service.js
      workers/
        worker.runner.js
        jobs/
          ingest-rss.job.js
          ingest-api.job.js
          ingest-scraper.job.js
          translate.job.js
          summarize.job.js
          embed.job.js
          cluster.job.js
          refresh-story-rank.job.js
      admin/
        source-admin.service.js
      config/
        env.js
        db.js
        logger.js
      utils/
        time.js
        hashing.js
        language.js
    tests/
      unit/
      integration/
    scripts/
      migrate.js
      seed-sources.js
    deployment/
      render.yaml
  docs/
    zenadam-mvp-technical-spec.md
  .env.example
  README.md
```

## Build order for development

1. Bootstrap backend runtime (`app.js`, `server.js`, config, DB).
2. Implement core Mongo models + indexes.
3. Build admin source CRUD APIs.
4. Implement ingestion connectors + normalization/dedup.
5. Add async job system + worker runner.
6. Integrate translation/summarization/embedding services.
7. Implement clustering and story lifecycle.
8. Implement ranking services (story hotness + feed rank).
9. Expose public story/feed REST endpoints.
10. Add interaction logging and analytics basics.
11. Finalize deployment (`render.yaml`) and CI workflow.
12. Start mobile/web/admin UI integration.

## First 10 files to create

1. `backend/package.json`
2. `backend/src/server.js`
3. `backend/src/app.js`
4. `backend/src/config/env.js`
5. `backend/src/config/db.js`
6. `backend/src/api/routes/index.js`
7. `backend/src/models/source.model.js`
8. `backend/src/models/article.model.js`
9. `backend/src/models/story.model.js`
10. `backend/deployment/render.yaml`

## Sample `.env.example`

```dotenv
NODE_ENV=development
PORT=3000
API_BASE_PATH=/api/v1
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
MONGODB_DB_NAME=zenadam_dev
AI_API_KEY=<your_ai_provider_key>
AI_TRANSLATION_MODEL=<translation_model_name>
AI_SUMMARY_MODEL=<summarization_model_name>
AI_EMBEDDING_MODEL=<embedding_model_name>
QUEUE_BACKEND=mongodb
JWT_SECRET=<strong_secret_if_auth_enabled>
ADMIN_BASIC_AUTH_USER=admin
ADMIN_BASIC_AUTH_PASS=change_me
LOG_LEVEL=info
```

## Sample `render.yaml`

```yaml
services:
  - type: web
    name: zenadam-api
    env: node
    rootDir: backend
    buildCommand: npm ci
    startCommand: npm run start
    healthCheckPath: /api/v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: MONGODB_DB_NAME
        value: zenadam_prod
      - key: AI_API_KEY
        sync: false
      - key: AI_TRANSLATION_MODEL
        value: <model>
      - key: AI_SUMMARY_MODEL
        value: <model>
      - key: AI_EMBEDDING_MODEL
        value: <model>

  - type: worker
    name: zenadam-worker
    env: node
    rootDir: backend
    buildCommand: npm ci
    startCommand: npm run worker
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: MONGODB_DB_NAME
        value: zenadam_prod
      - key: AI_API_KEY
        sync: false

cronJobs:
  - name: zenadam-cron
    env: node
    rootDir: backend
    schedule: "*/15 * * * *"
    buildCommand: npm ci
    startCommand: npm run cron
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: MONGODB_DB_NAME
        value: zenadam_prod
```

## Sample GitHub Actions CI workflow outline

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend-ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: npm run test:integration --if-present

  config-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate render.yaml exists
        run: test -f backend/deployment/render.yaml
      - name: Validate env example exists
        run: test -f .env.example
```
