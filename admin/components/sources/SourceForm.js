'use client';

import { SOURCE_TYPE_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const FIELD_CLASS =
  'input-surface mt-2 w-full rounded-2xl px-4 py-3 text-[15px] text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:bg-surface-strong';

export function SourceForm({
  form,
  onChange,
  onSubmit,
  onValidate,
  isSubmitting = false,
  isValidating = false,
  submitLabel = 'Save candidate source',
  validationSection = null
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-[15px] font-medium text-text">
          Source name
          <input className={FIELD_CLASS} name="name" value={form.name} onChange={onChange} placeholder="Add a clear newsroom name" />
        </label>

        <label className="text-[15px] font-medium text-text">
          Slug
          <input className={FIELD_CLASS} name="slug" value={form.slug} onChange={onChange} placeholder="example-amharic" />
        </label>

        <label className="text-[15px] font-medium text-text">
          Homepage URL
          <input className={FIELD_CLASS} name="baseUrl" value={form.baseUrl} onChange={onChange} placeholder="https://example.com" />
        </label>

        <label className="text-[15px] font-medium text-text">
          RSS feed URL
          <input className={FIELD_CLASS} name="feedUrl" value={form.feedUrl} onChange={onChange} placeholder="https://example.com/feed.xml" />
        </label>

        <label className="text-[15px] font-medium text-text md:max-w-[220px]">
          Language
          <input className={FIELD_CLASS} name="language" value={form.language} onChange={onChange} placeholder="am" />
        </label>

        <label className="text-[15px] font-medium text-text md:max-w-[220px]">
          Quality score
          <input
            className={FIELD_CLASS}
            type="number"
            min="0"
            max="1"
            step="0.01"
            name="sourceQualityScore"
            value={form.sourceQualityScore ?? ''}
            onChange={onChange}
            placeholder="0.75"
          />
        </label>

        <label className="text-[15px] font-medium text-text md:col-span-2">
          Quality rationale
          <input
            className={FIELD_CLASS}
            name="sourceQualityRationale"
            value={form.sourceQualityRationale ?? ''}
            onChange={onChange}
            placeholder="regional newsroom with broad coverage"
          />
        </label>
      </div>

      <div>
        <p className="text-[15px] font-medium text-text">Source type</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {SOURCE_TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition',
                form.type === option.value ? 'border-accent bg-accent/10' : 'ghost-surface',
                !option.enabled && 'cursor-not-allowed opacity-65'
              )}
            >
              <input
                type="radio"
                name="type"
                value={option.value}
                checked={form.type === option.value}
                onChange={onChange}
                disabled={!option.enabled}
                className="mt-1"
              />
              <span>
                <span className="block text-[15px] font-semibold text-text">{option.label}</span>
                <span className="mt-1 block text-sm leading-5 text-text-muted">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {validationSection}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onValidate}
          disabled={isValidating || isSubmitting}
          className="ghost-surface inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[15px] font-semibold text-text transition hover:border-accent hover:bg-surface-strong disabled:cursor-wait disabled:opacity-60"
        >
          {isValidating ? 'Validating...' : 'Validate source'}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast transition hover:bg-[#72e79a] disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
