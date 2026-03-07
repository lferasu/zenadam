import { env } from './env.js';

const withPrefix = (level, message, meta = {}) => {
  const payload = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console[level](`[${new Date().toISOString()}] [${env.LOG_LEVEL}] ${message}${payload}`);
};

export const logger = {
  info: (message, meta) => withPrefix('log', message, meta),
  warn: (message, meta) => withPrefix('warn', message, meta),
  error: (message, meta) => withPrefix('error', message, meta)
};
