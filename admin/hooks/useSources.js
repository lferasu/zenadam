'use client';

import { useCallback, useEffect, useState } from 'react';
import { listSources } from '@/services/adminApi';

export const useSources = () => {
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listSources();
      setSources(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  return {
    sources,
    isLoading,
    error,
    reload: loadSources,
    setSources
  };
};
