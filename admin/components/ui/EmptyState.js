export function EmptyState({ title, description, action }) {
  return (
    <div className="panel rounded-[28px] p-6 shadow-glow">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">No sources yet</p>
      <h2 className="mt-3 text-2xl font-semibold text-text">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-7 text-text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
