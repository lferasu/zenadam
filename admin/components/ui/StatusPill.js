import { cn } from '@/lib/utils';

const THEMES = {
  candidate: 'border-warning/35 bg-warning/14 text-warning shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  active: 'border-success/35 bg-success/14 text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  inactive: 'border-line bg-surface-strong text-text-muted',
  valid: 'border-success/35 bg-success/14 text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  warning: 'border-warning/35 bg-warning/14 text-warning shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  invalid: 'border-danger/35 bg-danger/14 text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
  failed: 'border-danger/35 bg-danger/14 text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
  not_run: 'border-line bg-surface-strong text-text-muted',
  info: 'border-info/35 bg-info/14 text-info shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
};

export function StatusPill({ tone = 'info', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]',
        THEMES[tone] ?? THEMES.info
      )}
    >
      {children}
    </span>
  );
}
