/**
 * Detects transient database errors that occur when a serverless Postgres compute
 * is waking from sleep (Neon free-tier auto-suspend). These happen before any
 * query executes, so retrying is safe.
 */
export function isTransientDbError(error: unknown): boolean {
  const e = error as { name?: string; code?: string; message?: string };
  if (e?.name === 'PrismaClientInitializationError') {
    return true;
  }
  const code = e?.code ?? '';
  if (code === 'P1001' || code === 'P1002' || code === 'P1017') {
    return true;
  }
  const msg = String(e?.message ?? '');
  return /can't reach database server|authentication failed against database|connection (terminated|reset|closed)|ECONNRESET|ETIMEDOUT|server has closed the connection/i.test(
    msg,
  );
}

/**
 * Runs an async DB operation, retrying transient wake-up failures with backoff.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientDbError(error) || attempt === maxRetries) {
        throw error;
      }
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 800));
    }
  }
  throw lastError;
}
