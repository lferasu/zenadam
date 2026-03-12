'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SaveSuccessState } from './SaveSuccessState';
import { SourceForm } from './SourceForm';
import { ValidationResultsPanel } from './ValidationResultsPanel';
import { createCandidateSource, validateSource } from '@/services/adminApi';

const INITIAL_FORM = {
  slug: '',
  baseUrl: '',
  feedUrl: '',
  name: '',
  language: 'am',
  type: 'rss'
};

const deriveValidationStatus = (result) => {
  if (!result) {
    return 'not_run';
  }

  return result.isValid ? (result.warnings?.length ? 'warning' : 'valid') : 'invalid';
};

export function NewSourceShell() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [validation, setValidation] = useState(null);
  const [validationStatus, setValidationStatus] = useState('not_run');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [savedSource, setSavedSource] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const result = await validateSource(form);
      setValidation(result);
      setValidationStatus(deriveValidationStatus(result));
    } catch (validationError) {
      setError(validationError.message);
      setValidationStatus('failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const saved = await createCandidateSource(form);
      setSavedSource(saved);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (savedSource) {
    return <SaveSuccessState source={savedSource} />;
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
      <div className="panel rounded-[30px] p-5 shadow-glow sm:p-6">
        <div className="flex flex-col gap-4 border-b border-line pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Add source</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">
              Queue a new candidate source
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-muted">
              Fill in the basics, validate when helpful, and save even if the feed is having a bad day.
            </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/sources"
                className="ghost-surface inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[15px] font-medium text-text"
              >
                Sources
              </Link>
              <Link
                href="/sources"
                className="ghost-surface inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[15px] font-medium text-text"
              >
                Go back
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <SourceForm
            form={form}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onValidate={handleValidate}
            isSubmitting={isSubmitting}
            isValidating={isValidating}
          />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-info">How this works</p>
          <div className="mt-4 space-y-4 text-[15px] leading-7 text-text-muted">
            <p>New sources from this screen go into the candidate queue, not the main active source registry.</p>
            <p>Validation is only guidance. It helps you spot weak feeds but never blocks saving.</p>
            <p>Only RSS is enabled right now, so this form stays focused and simple.</p>
          </div>
        </div>

        <div className="panel rounded-[30px] p-5 sm:p-6">
          <div className="space-y-3">
            {error ? (
              <div className="rounded-2xl border border-danger/25 bg-danger/10 p-3 text-[15px] leading-6 text-danger">
                {error}
              </div>
            ) : null}
            {validation ? (
              <ValidationResultsPanel validationStatus={validationStatus} validationResults={validation} />
            ) : (
              <div className="ghost-surface rounded-3xl p-4 text-[15px] leading-7 text-text-muted">
                Validation has not run yet. You can still save this source directly to `candidate_sources`.
              </div>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}
