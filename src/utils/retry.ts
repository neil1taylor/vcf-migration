// Retry utility with exponential backoff for API calls

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryableErrors?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'retryableErrors'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
};

/**
 * Determine if an error is retryable (transient)
 * - Network errors
 * - Timeout errors
 * - 5xx server errors
 * - 429 rate limiting
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network/fetch errors
  if (message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('aborted') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout')) {
    return true;
  }

  // HTTP status codes in error message
  const statusMatch = message.match(/\b(5\d{2}|429)\b/);
  if (statusMatch) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number
): number {
  // Exponential backoff: initialDelay * (factor ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry logic and exponential backoff
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetchFromApi('/endpoint'),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffFactor,
  } = { ...DEFAULT_OPTIONS, ...options };

  const shouldRetry = options?.retryableErrors || isRetryableError;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const delayMs = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffFactor);

        // Call onRetry callback if provided
        options?.onRetry?.(lastError, attempt + 1, delayMs);

        await sleep(delayMs);
      } else {
        // Either max retries reached or error is not retryable
        throw lastError;
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retry wrapper for a specific function with preset options
 *
 * @example
 * ```ts
 * const fetchWithRetry = createRetryWrapper(
 *   fetchData,
 *   { maxRetries: 3 }
 * );
 * const data = await fetchWithRetry(arg1, arg2);
 * ```
 */
export function createRetryWrapper<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: RetryOptions
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
