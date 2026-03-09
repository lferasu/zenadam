# Source Audit

The source audit validates active source records in MongoDB and reports operational health.

## What it checks

- `rss`:
  - feed URL reachable
  - valid XML (RSS/Atom)
  - non-empty feed items
  - latest published date freshness
- `scraper`:
  - entry page reachable
  - HTML parseable
  - article-like links detectable via selector config or fallback selectors
- `api`:
  - currently marked as unsupported audit placeholder (`warn`)

## Run

```bash
cd backend
npm run audit:sources
```

Optional: write summary health fields back to `sources` documents:

```bash
npm run audit:sources -- --write-back
```

## Output

- Console table for quick read
- JSON report file:
  - `backend/tmp/source-audit-report.json`

Per-source fields include:
- `slug`
- `name`
- `type`
- `testedUrls`
- `status` (`pass` | `warn` | `fail`)
- `reason`
- `itemCount` / `articleLinkCount`
- `latestPublishedAt`
- `freshness` (`fresh` | `ok` | `aging` | `stale` | `unknown`)
- `scrapable`
- `auditedAt`

## Status meaning

- `pass`: source is reachable and has strong ingest signal
- `warn`: source reachable but weak/partial signal (or unsupported type)
- `fail`: source likely unusable (network/parsing hard failure)
