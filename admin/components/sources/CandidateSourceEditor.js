'use client';

import { useState } from 'react';
import { SourceForm } from './SourceForm';
import { ValidationResultsPanel } from './ValidationResultsPanel';
import { updateCandidateSource, validateSource } from '@/services/adminApi';

const toFormState = (source) => ({
  slug: source.slug ?? '',
  baseUrl: source.baseUrl ?? '',
  feedUrl: source.feedUrl ?? '',
  name: source.name ?? '',
  language: source.language ?? '',
  type: source.type ?? 'rss',
  sourceQualityScore:
    source.sourceQuality?.score !== undefined && source.sourceQuality?.score !== null ? String(source.sourceQuality.score) : '',
  sourceQualityRationale: source.sourceQuality?.rationale ?? ''
});

export function CandidateSourceEditor({ source, onSaved }) {
  const [form, setForm] = useState(toFormState(source));
  const [validation, setValidation] = useState(source.validationResults ?? null);
  const [status, setStatus] = useState(source.validationStatus ?? 'not_run');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const runValidation = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const result = await validateSource(form);
      setValidation(result);
      setStatus(result.isValid ? (result.warnings?.length ? 'warning' : 'valid') : 'invalid');
    } catch (validationError) {
      setError(validationError.message);
      setStatus('failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const saved = await updateCandidateSource(source.id, form);
      setValidation(saved.validationResults ?? null);
      setStatus(saved.validationStatus ?? 'not_run');
      onSaved(saved);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-5 rounded-3xl border border-line bg-surface-muted/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-warning">Candidate editor</p>
      <p className="mt-2 text-sm text-text-muted">You can revise candidate sources here without leaving the list.</p>
      <div className="mt-4">
        <SourceForm
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onValidate={runValidation}
          isSubmitting={isSubmitting}
          isValidating={isValidating}
          submitLabel="Update candidate"
          validationSection={
            validation || error ? (
              <div className="space-y-3">
                {error ? (
                  <div className="rounded-2xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">{error}</div>
                ) : null}
                {validation ? <ValidationResultsPanel validationStatus={status} validationResults={validation} compact /> : null}
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
