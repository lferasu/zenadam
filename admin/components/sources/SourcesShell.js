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

const getQualityScore = (source) => Number(source.sourceQuality?.score ?? 0);

export function SourcesShell({ searchQuery = '' }) {
  const { sources, isLoading, error, reload, setSources } = useSources();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [sortMode, setSortMode] = useState('updated');
  const [qualityFilter, setQualityFilter] = useState('all');

  const filteredSources = useMemo(() => {
    const normalizedQuery = localQuery.trim().toLowerCase();

    let nextSources = normalizedQuery ? sources.filter((source) => toSearchText(source).includes(normalizedQuery)) : [...sources];

    if (qualityFilter === 'high') {
      nextSources = nextSources.filter((source) => getQualityScore(source) >= 0.85);
    } else if (qualityFilter === 'medium') {
      nextSources = nextSources.filter((source) => getQualityScore(source) >= 0.7 && getQualityScore(source) < 0.85);
    } else if (qualityFilter === 'low') {
      nextSources = nextSources.filter((source) => getQualityScore(source) < 0.7);
    } else if (qualityFilter === 'candidates') {
      nextSources = nextSources.filter((source) => source.isCandidate);
    }

    nextSources.sort((left, right) => {
      if (sortMode === 'quality_desc') {
        return getQualityScore(right) - getQualityScore(left);
      }

      if (sortMode === 'quality_asc') {
        return getQualityScore(left) - getQualityScore(right);
      }

      if (sortMode === 'candidate_first') {
        if (left.isCandidate !== right.isCandidate) {
          return left.isCandidate ? -1 : 1;
        }
      }

      const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? 0);
      const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? 0);
      return rightTime - leftTime;
    });

    return nextSources;
  }, [localQuery, qualityFilter, sortMode, sources]);

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
    <div className="space-y-3 sm:space-y-4">
      <div className="panel-subtle rounded-[20px] p-3 sm:rounded-[22px] sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Search sources</p>
              <p className="mt-1 text-sm leading-5 text-text-muted">Name, slug, URL, type, language, or status.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/stories-test"
                className="ghost-surface inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium text-text sm:hidden"
              >
                Stories
              </Link>
              <Link
                href="/sources/new"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-contrast shadow-[0_12px_30px_rgba(34,197,94,0.22)] transition hover:-translate-y-0.5 sm:hidden"
              >
                Add
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={localQuery}
              onChange={(event) => setLocalQuery(event.target.value)}
              placeholder="Search sources..."
              className="input-surface min-w-0 flex-1 rounded-2xl px-4 py-3 text-[15px] text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:bg-surface-strong"
            />
            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value)}
              className="input-surface min-h-11 rounded-2xl px-4 text-sm text-text outline-none transition focus:border-accent focus:bg-surface-strong"
            >
              <option value="all">All quality tiers</option>
              <option value="high">High quality</option>
              <option value="medium">Medium quality</option>
              <option value="low">Low quality</option>
              <option value="candidates">Candidates only</option>
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="input-surface min-h-11 rounded-2xl px-4 text-sm text-text outline-none transition focus:border-accent focus:bg-surface-strong"
            >
              <option value="updated">Recently updated</option>
              <option value="quality_desc">Highest quality</option>
              <option value="quality_asc">Lowest quality</option>
              <option value="candidate_first">Candidates first</option>
            </select>
            <Link
              href="/stories-test"
              className="ghost-surface hidden min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium text-text sm:inline-flex"
            >
              Story test
            </Link>
            <Link
              href="/sources/new"
              className="hidden min-h-11 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast shadow-[0_12px_30px_rgba(34,197,94,0.22)] transition hover:-translate-y-0.5 sm:inline-flex"
            >
              Add source
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card-surface rounded-[18px] px-3 py-3 sm:rounded-[22px] sm:p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted sm:text-xs sm:tracking-[0.24em]">All</p>
          <p className="mt-2 text-2xl font-semibold text-text sm:text-3xl">{counts.total}</p>
        </div>
        <div className="card-surface rounded-[18px] px-3 py-3 sm:rounded-[22px] sm:p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted sm:text-xs sm:tracking-[0.24em]">Active</p>
          <p className="mt-2 text-2xl font-semibold text-text sm:text-3xl">{counts.active}</p>
        </div>
        <div className="card-surface rounded-[18px] px-3 py-3 sm:rounded-[22px] sm:p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted sm:text-xs sm:tracking-[0.24em]">Candidates</p>
          <p className="mt-2 text-2xl font-semibold text-text sm:text-3xl">{counts.candidate}</p>
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
