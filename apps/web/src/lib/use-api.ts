'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';
import { useAuth } from './auth-context';

interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetch from the backend with the current Firebase token. Re-runs when the path,
 * token, or any extra dependency changes. Skips until a token is available.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): ApiResult<T> {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path || !token) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<T>(path, { token })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, nonce, ...deps]);

  return { data, loading, error, reload };
}
