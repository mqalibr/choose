interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 700;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      options.onRetry?.(error, attempt);
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}
