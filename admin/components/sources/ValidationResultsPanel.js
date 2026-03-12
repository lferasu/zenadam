import { ValidationBadge } from './ValidationBadge';

const CHECK_LABELS = {
  homepageReachable: 'Homepage reachable',
  feedReachable: 'Feed reachable',
  feedParseable: 'Feed parseable',
  feedHasItems: 'Feed has items'
};

const renderCheckState = (value) => {
  if (value === true) {
    return 'Pass';
  }

  if (value === false) {
    return 'Fail';
  }

  return 'N/A';
};

export function ValidationResultsPanel({ validationStatus, validationResults, compact = false }) {
  const issues = validationResults?.issues ?? [];
  const warnings = validationResults?.warnings ?? [];
  const checks = validationResults?.checks ?? {};

  return (
    <section className="ghost-surface rounded-3xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Validation</p>
          <p className="mt-1 text-[15px] leading-6 text-text-muted">
            Informational only. Save remains available even when warnings or failures show up.
          </p>
        </div>
        <ValidationBadge status={validationStatus} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {Object.entries(CHECK_LABELS).map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p>
            <p className="mt-1 text-base font-medium text-text">{renderCheckState(checks[key])}</p>
          </div>
        ))}
      </div>

      {!compact && validationResults?.sampleCount ? (
        <p className="mt-4 text-[15px] text-text-muted">Sample items detected: {validationResults.sampleCount}</p>
      ) : null}

      {warnings.length ? (
        <div className="mt-4 rounded-2xl border border-warning/25 bg-warning/10 p-3 text-[15px] leading-6 text-warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {issues.length ? (
        <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-[15px] leading-6 text-danger">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
