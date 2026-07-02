import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, retry, timer } from 'rxjs';
import { isTransientDbError } from '../utils/db-retry';

/**
 * Retries a request when it fails because the database was waking from sleep.
 *
 * Serverless Postgres (e.g. Neon free tier) auto-suspends the compute; the first
 * query after idle can fail with a connection/authentication error while it wakes.
 * Such failures happen BEFORE any query executes, so retrying is side-effect safe.
 * Only transient connection-class errors are retried.
 */
@Injectable()
export class DbRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DbRetryInterceptor.name);
  private static readonly MAX_RETRIES = 3;

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      retry({
        count: DbRetryInterceptor.MAX_RETRIES,
        delay: (error: unknown, retryCount: number) => {
          if (!isTransientDbError(error)) {
            throw error;
          }
          this.logger.warn(
            `Transient DB error — retry ${retryCount}/${DbRetryInterceptor.MAX_RETRIES}`,
          );
          // Back off to give the compute time to finish waking (~0.8s, 1.6s, 2.4s).
          return timer(retryCount * 800);
        },
      }),
    );
  }
}
