import { VALIDATION_STATUS_LABELS } from '@/lib/constants';
import { StatusPill } from '@/components/ui/StatusPill';

export function ValidationBadge({ status = 'not_run' }) {
  return <StatusPill tone={status}>{VALIDATION_STATUS_LABELS[status] ?? 'Unknown'}</StatusPill>;
}
