'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorRetryState } from '@/components/ui/ErrorRetryState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSources } from '@/hooks/useSources';
import { SourceAccordionList } from './SourceAccordionList';

const toSearchText = (source) =>
  [
    source.name,
    source.slug,
    source.baseUrl,
    source.feedUrl,
    source.language,
    source.category,
    source.type,
    source.status,
    source.isCandidate ? 'candidate' : 'active'
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function SourcesShell({ searchQuery = '' }) {
  const { sources, isLoading, error, reload, setSources } = useSources();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const filteredSources = useMemo(() => {
    const normalizedQuery = localQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return sources;
    }

    return sources.filter((source) => toSearchText(source).includes(normalizedQuery));
  }, [localQuery, sources]);

  const counts = useMemo(() => {
    const candidateCount = filteredSources.filter((source) => source.isCandidate).length;
    return {
      total: filteredSources.length,
      candidate: candidateCount,
      active: filteredSources.length - candidateCount
    };
  }, [filteredSources]);

  const handleCandidateSaved = (updatedSource) => {
    setSources((current) =>
      current.map((source) =>
        source.id === updatedSource.id && source.sourceSet === updatedSource.sourceSet ? updatedSource : source
      )
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorRetryState
        title="Could not load sources"
        description="The source registry did not come back cleanly. Retry without losing your admin workflow."
        onRetry={reload}
      />
    );
  }

  if (!sources.length) {
    return (
      <EmptyState
        title="Your source catalog is still empty"
        description="Once sources or candidate sources exist in the backend, they will show up together here in one mobile-friendly workflow."
        action={
          <Link
            href="/sources/new"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-contrast shadow-[0_12px_30px_rgba(34,197,94,0.22)]"
          >
            Add the first candidate source
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel-subtle rounded-[22px] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Search sources</p>
            <p className="mt-1 text-[15px] leading-6 text-text-muted">
              Search by source name, slug, URL, type, language, or candidate status.
            </p>
          </div>
          <div className="w-full lg:max-w-xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={localQuery}
                onChange={(event) => setLocalQuery(event.target.value)}
                placeholder="Search sources..."
                className="input-surface min-w-0 flex-1 rounded-2xl px-4 py-3 text-[15px] text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:bg-surface-strong"
              />
              <Link
                href="/sources/new"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast shadow-[0_12px_30px_rgba(34,197,94,0.22)] transition hover:-translate-y-0.5"
              >
                Add source
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-surface rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-text-muted">All sources</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-3xl font-semibold text-text">{counts.total}</p>
            <p className="text-right text-[13px] leading-5 text-text-muted">Active + candidates</p>
          </div>
        </div>
        <div className="card-surface rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Active</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-3xl font-semibold text-text">{counts.active}</p>
            <p className="text-right text-[13px] leading-5 text-text-muted">Read-only sources</p>
          </div>
        </div>
        <div className="card-surface rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-text-muted">Candidates</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-3xl font-semibold text-text">{counts.candidate}</p>
            <p className="text-right text-[13px] leading-5 text-text-muted">Editable intake</p>
          </div>
        </div>
      </div>

      {localQuery.trim() && !filteredSources.length ? (
        <EmptyState
          title="No sources matched your search"
          description="Try a source name, slug, URL fragment, language, or whether it is a candidate source."
          action={
            <button
              type="button"
              onClick={() => setLocalQuery('')}
              className="ghost-surface inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-text"
            >
              Clear search
            </button>
          }
        />
      ) : (
        <SourceAccordionList sources={filteredSources} onCandidateSaved={handleCandidateSaved} />
      )}
    </div>
  );
}
