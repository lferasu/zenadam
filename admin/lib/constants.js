export const SOURCE_TYPE_OPTIONS = [
  {
    value: 'rss',
    label: 'RSS',
    description: 'Ready now for feed-based source onboarding.',
    enabled: true
  },
  {
    value: 'scrape',
    label: 'Scrape',
    description: 'Coming later for custom page extraction.',
    enabled: false
  },
  {
    value: 'api',
    label: 'API',
    description: 'Coming later for direct provider integrations.',
    enabled: false
  }
];

export const VALIDATION_STATUS_LABELS = {
  valid: 'RSS Valid',
  warning: 'Needs Review',
  invalid: 'RSS Invalid',
  failed: 'Validation Failed',
  not_run: 'Validation Not Run'
};
