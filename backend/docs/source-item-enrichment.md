# Source item enrichment (normalization stage)

Zenadam runs source-item enrichment inside the normalization stage, before clustering and story creation.

Pipeline order:

1. Ingestion stores raw source items.
2. Normalization/enrichment transforms each raw source item into an enriched normalized item.
3. Clustering reads normalized items only.
4. Story APIs serve clustered stories.

## Language behavior

- `ZENADAM_TARGET_LANGUAGE` controls the output language for all user-facing normalized fields.
- Required user-facing normalized fields include:
  - `normalizedTitle`
  - `normalizedDetailedSummary`
  - `structuredSummary.bullets`
  - `structuredSummary.paragraph`
  - `snippet`
- If source language differs from target language and translation config is missing, the item enrichment fails explicitly and the item is not marked ready for clustering.

## Required env vars for AI-assisted enrichment

- `ZENADAM_TARGET_LANGUAGE` (default `am`)
- `OPENAI_API_KEY` (required when translation is needed)
- `AI_TRANSLATION_MODEL` (optional override, defaults to `gpt-4o-mini`)

## Failure handling

Enrichment is batch-safe:

- One failed item does not fail the whole batch.
- Failures are marked on the source item with status `failed` and metadata.
- Failed items are not persisted as successful normalized items and do not become clustering-ready.

## Throughput tuning

- `ZENADAM_NORMALIZATION_CONCURRENCY` controls how many source items are enriched in parallel within one normalization batch.
- This improves throughput without changing enrichment semantics, status handling, or downstream clustering eligibility rules.
