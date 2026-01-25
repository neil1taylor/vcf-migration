// Standardized logging utility for consistent error reporting

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  module?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  retryable?: boolean;
  context?: LogContext;
}

/**
 * Format a log message with consistent structure
 */
function formatMessage(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${contextStr}`;
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(module: string) {
  return {
    debug(message: string, context?: LogContext): void {
      if (import.meta.env.DEV) {
        console.debug(formatMessage('debug', module, message, context));
      }
    },

    info(message: string, context?: LogContext): void {
      console.info(formatMessage('info', module, message, context));
    },

    warn(message: string, context?: LogContext): void {
      console.warn(formatMessage('warn', module, message, context));
    },

    error(message: string, error?: Error | unknown, context?: LogContext): void {
      const errorDetails = error instanceof Error
        ? { errorMessage: error.message, errorName: error.name }
        : error
          ? { errorDetails: String(error) }
          : {};

      console.error(formatMessage('error', module, message, { ...context, ...errorDetails }));
    },
  };
}

/**
 * Parse an API error response into a standardized ApiError
 */
export async function parseApiError(response: Response, operation: string): Promise<ApiError> {
  let errorMessage = `${operation} failed: ${response.status} ${response.statusText}`;
  let code: string | undefined;

  try {
    const errorText = await response.text();
    if (errorText) {
      try {
        const errorData = JSON.parse(errorText);
        // IBM Cloud API error format
        if (errorData.errors?.[0]) {
          code = errorData.errors[0].code;
          errorMessage = errorData.errors[0].message || errorMessage;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Not JSON, use text as-is if informative
        if (errorText.length < 200) {
          errorMessage = `${operation} failed: ${errorText}`;
        }
      }
    }
  } catch {
    // Ignore errors reading response body
  }

  return {
    message: errorMessage,
    code,
    status: response.status,
    retryable: response.status >= 500 || response.status === 429,
  };
}

/**
 * Determine if an error is an authentication/authorization error
 */
export function isAuthError(error: Error | ApiError): boolean {
  const message = 'message' in error ? error.message.toLowerCase() : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code.toLowerCase() : '';
  const status = 'status' in error ? error.status : undefined;

  return (
    status === 401 ||
    status === 403 ||
    code === 'not_authorized' ||
    code === 'unauthorized' ||
    message.includes('authentication') ||
    message.includes('authorization') ||
    message.includes('not authorized') ||
    message.includes('unauthorized')
  );
}

/**
 * Determine if an error is a CORS error
 */
export function isCorsError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    (error instanceof TypeError && message === 'failed to fetch') ||
    message.includes('cors') ||
    message.includes('cross-origin')
  );
}

/**
 * Create a user-friendly error message from an API error
 */
export function getUserFriendlyMessage(error: Error | ApiError): string {
  if (isAuthError(error)) {
    return 'Authentication failed. Please check your API key configuration.';
  }

  if (error instanceof Error && isCorsError(error)) {
    return 'Network request blocked. This may be a CORS issue - try using the proxy configuration.';
  }

  const message = 'message' in error ? error.message : String(error);
  const status = 'status' in error ? error.status : undefined;

  if (status === 429) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }

  if (status && status >= 500) {
    return 'IBM Cloud service is temporarily unavailable. Please try again later.';
  }

  if (message.includes('timeout') || message.includes('aborted')) {
    return 'Request timed out. Please check your network connection and try again.';
  }

  // Return a sanitized version of the error message
  return message.length > 200 ? `${message.substring(0, 200)}...` : message;
}
