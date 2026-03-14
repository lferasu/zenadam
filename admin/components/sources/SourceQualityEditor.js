'use client';

import { useState } from 'react';
import { updateCandidateSource, updateSource } from '@/services/adminApi';

const toQualityForm = (source) => ({
  sourceQualityScore:
    source.sourceQuality?.score !== undefined && source.sourceQuality?.score !== null ? String(source.sourceQuality.score) : '',
  sourceQualityRationale: source.sourceQuality?.rationale ?? ''
});

export function SourceQualityEditor({ source, onSaved }) {
  const [form, setForm] = useState(toQualityForm(source));
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        sourceQualityScore: form.sourceQualityScore === '' ? null : Number(form.sourceQualityScore),
        sourceQualityRationale: form.sourceQualityRationale.trim()
      };

      const saved = source.isCandidate
        ? await updateCandidateSource(source.id, payload)
        : await updateSource(source.id, payload);

      onSaved(saved);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-5 rounded-3xl border border-line bg-surface-muted/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Source quality</p>
      <p className="mt-2 text-sm text-text-muted">
        Set a manual quality score from 0 to 1 and note why. This feeds story and article ranking directly.
      </p>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="text-[15px] font-medium text-text">
            Quality score
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              name="sourceQualityScore"
              value={form.sourceQualityScore}
              onChange={handleChange}
              placeholder="0.75"
              className="input-surface mt-2 w-full rounded-2xl px-4 py-3 text-[15px] text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:bg-surface-strong"
            />
          </label>

          <label className="text-[15px] font-medium text-text">
            Rationale
            <input
              name="sourceQualityRationale"
              value={form.sourceQualityRationale}
              onChange={handleChange}
              placeholder="regional newsroom with strong editorial consistency"
              className="input-surface mt-2 w-full rounded-2xl px-4 py-3 text-[15px] text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:bg-surface-strong"
            />
          </label>
        </div>

        {error ? <div className="rounded-2xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast transition hover:bg-[#72e79a] disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? 'Saving quality...' : source.isCandidate ? 'Save candidate quality' : 'Save source quality'}
        </button>
      </form>
    </div>
  );
}
