import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';
import { useAuth } from './auth';

// Stale-while-revalidate cache: navigating back to a screen renders the last
// data instantly (no spinner) while a fresh copy loads quietly behind it.
const cache = new Map<string, unknown>();

export function useApi<T>(path: string | null) {
  const { token } = useAuth();
  const cached = path ? (cache.get(path) as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path || !token) {
      return;
    }
    let cancelled = false;
    const hit = cache.get(path) as T | undefined;
    if (hit !== undefined) {
      setData(hit);
      setLoading(false); // background refresh — no spinner
    } else {
      setLoading(true);
    }
    setError(null);
    apiRequest<T>(path, { token })
      .then((res) => {
        cache.set(path, res);
        if (!cancelled) setData(res);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, token, nonce]);

  return { data, loading, error, reload };
}
