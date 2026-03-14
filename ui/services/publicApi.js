const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:10000/api/v1';

const buildUrl = (path) => {
  const normalizedBase = DEFAULT_API_BASE_URL.endsWith('/') ? DEFAULT_API_BASE_URL : `${DEFAULT_API_BASE_URL}/`;
  const normalizedPath = String(path).replace(/^\/+/, '');
  return new URL(normalizedPath, normalizedBase).toString();
};

const parseEnvelope = async (response) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? 'Request failed';
    const error = new Error(message);
    error.code = payload?.error?.code ?? 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }

  return payload?.data ?? null;
};

const request = async (path, { includeMeta = false } = {}) => {
  const response = await fetch(buildUrl(path), {
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? 'Request failed';
    const error = new Error(message);
    error.code = payload?.error?.code ?? 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }

  if (includeMeta) {
    return {
      data: payload?.data ?? null,
      meta: payload?.meta ?? null
    };
  }

  return payload?.data ?? null;
};

export const listStories = async ({ sort = 'relevant', limit = 24, skip = 0, query } = {}) => {
  const searchParams = new globalThis.URLSearchParams();
  searchParams.set('sort', sort);
  searchParams.set('limit', String(limit));
  searchParams.set('skip', String(skip));
  if (query?.trim()) {
    searchParams.set('q', query.trim());
  }
  return request(`stories?${searchParams.toString()}`, { includeMeta: true });
};

export const getStory = async (storyId) => request(`stories/${storyId}`);
export const getStoryArticles = async (storyId) => request(`stories/${storyId}/articles`);
