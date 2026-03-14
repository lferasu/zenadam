export const cn = (...values) => values.filter(Boolean).join(' ');

export const formatRelativeTime = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const diff = date.getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  return rtf.format(days, 'day');
};

export const formatDateTime = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

export const clampText = (value, limit = 180) => {
  if (!value) {
    return '';
  }

  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
};
