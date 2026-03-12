import Link from 'next/link';
import { ValidationBadge } from './ValidationBadge';

export function SaveSuccessState({ source }) {
  return (
    <div className="rounded-4xl border border-success/30 bg-success/10 p-6 shadow-glow">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-success">Saved to candidate sources</p>
      <h2 className="mt-3 text-2xl font-semibold text-text">{source?.name ?? 'Source saved'}</h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        Validation stayed informational, so your source was saved even if the feed still needs attention.
      </p>
      <div className="mt-4">
        <ValidationBadge status={source?.validationStatus} />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/sources/new"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-text px-5 text-sm font-semibold text-surface"
        >
          Add another source
        </Link>
        <Link
          href="/sources"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-text"
        >
          Back to sources
        </Link>
      </div>
    </div>
  );
}
