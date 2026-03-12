'use client';

import { useState } from 'react';
import { CandidateSourceEditor } from './CandidateSourceEditor';
import { ValidationBadge } from './ValidationBadge';
import { ValidationResultsPanel } from './ValidationResultsPanel';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDateTime, titleCase } from '@/lib/utils';

const DetailRow = ({ label, value }) => (
  <div className="panel-subtle rounded-2xl px-4 py-3">
    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
    <p className="mt-1 text-sm text-text">{value || 'Not provided'}</p>
  </div>
);

export function SourceCard({ source, onCandidateSaved }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className="card-surface rounded-[28px] p-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={source.isCandidate ? 'candidate' : source.isActive ? 'active' : 'inactive'}>
              {source.isCandidate ? 'Candidate' : source.isActive ? 'Active' : 'Inactive'}
            </StatusPill>
            <ValidationBadge status={source.validationStatus} />
          </div>
          <h3 className="mt-4 truncate text-xl font-semibold text-text sm:text-[1.75rem]">
            {source.name || 'Unnamed source'}
          </h3>
          <p className="mt-2 text-sm font-medium text-text-muted">
            {source.slug || 'No slug'} {'\u00b7'} {titleCase(source.type || 'unknown')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
            {source.language ? <span className="panel-subtle rounded-full px-3 py-1.5">{source.language.toUpperCase()}</span> : null}
            {source.category ? <span className="panel-subtle rounded-full px-3 py-1.5">{source.category}</span> : null}
            {source.feedUrl ? <span className="panel-subtle max-w-full truncate rounded-full px-3 py-1.5">{source.feedUrl}</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className="panel-subtle rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-text-muted">
            {isOpen ? 'Collapse' : 'Expand'}
          </span>
          <span className="text-xl font-medium text-text-muted">{isOpen ? '−' : '+'}</span>
        </div>
      </button>

      {isOpen ? (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Homepage" value={source.baseUrl} />
            <DetailRow label="Feed URL" value={source.feedUrl || source.entryUrls?.[0]} />
            <DetailRow label="Language" value={source.language} />
            <DetailRow label="Category" value={source.category} />
            <DetailRow label="Status" value={titleCase(source.status)} />
            <DetailRow label="Last validated" value={formatDateTime(source.lastValidatedAt)} />
            <DetailRow label="Created" value={formatDateTime(source.createdAt)} />
            <DetailRow label="Updated" value={formatDateTime(source.updatedAt)} />
          </div>

          {source.validationResults ? (
            <ValidationResultsPanel validationStatus={source.validationStatus} validationResults={source.validationResults} />
          ) : null}

          {source.lastValidationMessage ? (
            <div className="panel-subtle rounded-2xl px-4 py-3 text-sm text-text-muted">{source.lastValidationMessage}</div>
          ) : null}

          {source.isCandidate ? <CandidateSourceEditor source={source} onSaved={onCandidateSaved} /> : null}
        </div>
      ) : null}
    </article>
  );
}
