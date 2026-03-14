const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

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

const request = async (path, options = {}) => {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    cache: 'no-store'
  });

  return parseEnvelope(response);
};

export const listSources = async () => request('admin/sources');
export const listStories = async (params = {}) => {
  const searchParams = new globalThis.URLSearchParams();

  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  if (params.sort) {
    searchParams.set('sort', String(params.sort));
  }

  const path = searchParams.size ? `stories?${searchParams.toString()}` : 'stories';
  return request(path);
};

export const getStoryArticles = async (storyId) => request(`stories/${storyId}/articles`);

export const validateSource = async (payload) =>
  request('admin/sources/validate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const createCandidateSource = async (payload) =>
  request('admin/candidate-sources', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const updateCandidateSource = async (id, payload) =>
  request(`admin/candidate-sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

export const updateSource = async (id, payload) =>
  request(`admin/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
