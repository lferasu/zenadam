export function LoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="panel animate-pulse rounded-[28px] p-5">
          <div className="h-4 w-28 rounded-full bg-surface-muted" />
          <div className="mt-5 h-7 w-2/3 rounded-full bg-surface-muted" />
          <div className="mt-4 h-4 w-full rounded-full bg-surface-muted" />
          <div className="mt-2 h-4 w-4/5 rounded-full bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}
