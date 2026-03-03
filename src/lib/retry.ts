import { logger } from './logger';

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 1000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`Retry ${attempt + 1}/${maxRetries} para ${label}`, {
          error: String(error),
          nextRetryMs: delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
