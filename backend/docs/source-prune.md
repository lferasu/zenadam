# Source Prune

Removes failed sources from MongoDB based on a fresh source audit run.

## Safety model

- Default mode is `dry-run` (no deletions).
- Deletion happens only with `--apply`.

## Run

Dry-run:

```bash
cd backend
npm run prune:sources
```

Apply deletion:

```bash
npm run prune:sources -- --apply
```

## Behavior

1. Runs source audit across active sources.
2. Selects sources with audit `status = fail`.
3. Deletes those source documents only when `--apply` is set.
4. Writes prune report to:
   - `backend/tmp/source-prune-report.json`
