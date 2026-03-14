export function EmptyState({ title, description, action = null }) {
  return (
    <section className="shell-panel rounded-[28px] px-5 py-8 text-center">
      <p className="text-sm uppercase tracking-[0.24em] text-text-muted">Nothing here yet</p>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-muted">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </section>
  );
}
