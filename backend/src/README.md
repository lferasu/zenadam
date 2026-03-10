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
