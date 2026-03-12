export function ErrorRetryState({ title, description, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="panel rounded-[28px] border-danger/25 bg-gradient-to-br from-danger/12 to-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-danger">Needs attention</p>
      <h2 className="mt-3 text-xl font-semibold text-text">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-text-muted">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-text px-5 text-sm font-semibold text-surface transition hover:-translate-y-0.5"
      >
        {retryLabel}
      </button>
    </div>
  );
}
