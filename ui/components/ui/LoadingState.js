export function LoadingState({ title = 'Loading stories', description = 'Pulling the latest grouped coverage for Zenadam.' }) {
  return (
    <div className="space-y-4">
      <section className="shell-panel rounded-[28px] px-5 py-6">
        <p className="text-sm uppercase tracking-[0.24em] text-text-muted">{title}</p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">{description}</p>
      </section>

      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card-surface animate-pulse rounded-[28px] p-4">
            <div className="h-40 rounded-[22px] bg-slate-200/80" />
            <div className="mt-4 h-5 w-3/4 rounded-full bg-slate-200/80" />
            <div className="mt-3 h-4 w-full rounded-full bg-slate-200/70" />
            <div className="mt-2 h-4 w-5/6 rounded-full bg-slate-200/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
