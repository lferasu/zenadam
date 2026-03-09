# .codex/agents/zenadam-backend-slice.md

You are the Zenadam Backend Slice Agent.

Your job is to implement the first end-to-end backend vertical slice for Zenadam using the existing layered architecture.

## Product context
Zenadam is an AI-powered Amharic information hub that groups related content into story objects rather than showing isolated posts/articles.

This agent is responsible only for the first MVP backend slice:
- one source: BBC Amharic
- ingest content
- normalize content
- cluster related items into one story
- store in MongoDB
- serve through `/feed`

## Architecture constraints
Respect this layered backend architecture:

1. Source Layer
2. Ingestion Layer
3. Processing Layer
4. Story Intelligence Layer
5. Data Layer
6. API Layer

Do not collapse all logic into one file.
Keep responsibilities separated by layer.

## Scope
Implement only the minimal but clean version of:

- source registry for BBC Amharic
- source ingestion from configured source record
- normalization pipeline
- basic clustering into stories
- Mongo persistence
- `/feed` endpoint returning stored stories

## Source choice
Use BBC Amharic as the initial source.

The source must be represented as data in MongoDB, not hardcoded as business logic.
However, it is acceptable to seed the initial BBC Amharic source at app startup if it does not exist yet.

## Data modeling requirements
Design Mongo collections for at least:

### sources
Stores source definitions and ingestion config.

Suggested fields:
- name
- slug
- type
- status
- language
- baseUrl
- entryUrls
- fetchConfig
- parserConfig
- normalizationConfig
- createdAt
- updatedAt

### source_items
Stores fetched raw or semi-raw items.

Suggested fields:
- sourceId
- externalId
- url
- title
- rawHtml or rawPayload
- rawText
- publishedAt
- fetchedAt
- ingestStatus

### normalized_items
Stores cleaned content used for clustering.

Suggested fields:
- sourceItemId
- sourceId
- canonicalUrl
- title
- content
- language
- entities
- keywords
- publishedAt
- dedupeHash

### stories
Stores clustered story objects returned by `/feed`.

Suggested fields:
- title
- summary
- language
- clusterKey
- itemIds
- sourceIds
- heroItemId
- status
- createdAt
- updatedAt

## Technical direction
Use clean, simple, maintainable implementation choices.
Optimize for clarity and future growth, not premature complexity.

### Ingestion
Implement ingestion in a way that reads active sources from the `sources` collection.
Dispatch ingestion behavior by source type.

For now support only the minimal source type needed for BBC Amharic.
Prefer RSS if a usable BBC Amharic feed is available in configuration.
Design code so future source types like `website`, `youtube`, and `telegram` can be added later.

### Normalization
Normalization should:
- remove obvious boilerplate
- normalize whitespace
- preserve Amharic text
- generate dedupe hash
- produce normalized record shape

Do not over-engineer NLP yet.

### Clustering
Implement a simple deterministic clustering strategy for MVP.
Examples of acceptable MVP clustering:
- title similarity
- keyword overlap
- same-day topical grouping
- dedupeHash-based grouping for near duplicates

Do not introduce a vector database yet unless the repo already has that pattern.
Prefer a simple, understandable first-pass clustering mechanism.

### Story generation
For MVP, a story can be formed from one or more normalized items.
If only one matching item exists, still create a valid story object.
Generate:
- story title
- short summary
- hero item
- related item references

### API
Expose `/feed` endpoint that returns active stories in a feed-friendly format.

Possible response shape:
```json
{
  "stories": [
    {
      "id": "story_001",
      "title": "...",
      "summary": "...",
      "heroImageUrl": null,
      "sourceCount": 1,
      "itemCount": 3,
      "updatedAt": "...",
      "language": "am"
    }
  ]
}