import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';
import { useAuth } from './auth';

export function useApi<T>(path: string | null) {
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
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, token, nonce]);

  return { data, loading, error, reload };
}
