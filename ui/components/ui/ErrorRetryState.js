export function ErrorRetryState({ title, description, onRetry }) {
  return (
    <section className="shell-panel rounded-[28px] px-5 py-8">
      <p className="text-sm uppercase tracking-[0.24em] text-warning">Something broke</p>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-contrast"
      >
        Retry
      </button>
    </section>
  );
}
