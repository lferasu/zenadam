# Story Reconciliation

Safely repairs fragmented one-item stories by merging strong matches into existing stories.

## Why it exists

If vector search is unavailable or candidate lookup is weak, incremental clustering can create too many single-item stories.
This tool performs a controlled reconciliation pass.

## Safety model

- Default mode is `dry-run` (no writes).
- Apply changes only with `--apply`.
- Source stories are archived after merge; they are not hard-deleted.

## Run

Dry-run:

```bash
cd backend
npm run reconcile:stories
```

Apply:

```bash
npm run reconcile:stories -- --apply
```

Optional scope controls:

```bash
npm run reconcile:stories -- --lookback-days=7 --limit=200 --strong-threshold=0.88
```

## What it does

1. Loads active singleton stories (`itemIds` size <= 1) in lookback window.
2. Finds a representative normalized item with embedding.
3. Finds recent candidate articles and scores candidate stories with existing clustering scoring logic.
4. If score >= threshold:
   - reassigns normalized items from source story to target story
   - merges source story items/sourceIds into target story
   - archives source story with `mergedIntoStoryId`
5. Writes report:
   - `backend/tmp/story-reconcile-report.json`
