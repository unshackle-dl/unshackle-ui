export const APIErrorType = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type APIErrorType = (typeof APIErrorType)[keyof typeof APIErrorType];

export class APIError extends Error {
  public readonly type: APIErrorType;
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly retryable: boolean;

  constructor(
    type: APIErrorType,
    message: string,
    status?: number,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
    this.type = type;
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = this.isRetryable(type, status);
  }

  private isRetryable(type: APIErrorType, status?: number): boolean {
    // Network errors and 5xx errors are retryable
    if (type === APIErrorType.NETWORK_ERROR || type === APIErrorType.TIMEOUT_ERROR) {
      return true;
    }

    // 5xx server errors are retryable
    if (status && status >= 500 && status < 600) {
      return true;
    }

    // 429 rate limit is retryable after delay
    if (status === 429) {
      return true;
    }

    return false;
  }

  static fromResponse(response: Response, data?: unknown): APIError {
    const status = response.status;
    
    switch (status) {
      case 401:
        return new APIError(
          APIErrorType.AUTHENTICATION_ERROR,
          'Authentication failed. Please check your API key.',
          status,
          undefined,
          data
        );
      
      case 403:
        return new APIError(
          APIErrorType.AUTHORIZATION_ERROR,
          'Access denied. You do not have permission to perform this action.',
          status,
          undefined,
          data
        );
      
      case 404:
        return new APIError(
          APIErrorType.NOT_FOUND_ERROR,
          'Resource not found.',
          status,
          undefined,
          data
        );
      
      case 422:
        return new APIError(
          APIErrorType.VALIDATION_ERROR,
          'Invalid request data.',
          status,
          undefined,
          data
        );
      
      case 429:
        return new APIError(
          APIErrorType.RATE_LIMIT_ERROR,
          'Rate limit exceeded. Please try again later.',
          status,
          undefined,
          data
        );
      
      default:
        if (status >= 500) {
          return new APIError(
            APIErrorType.SERVER_ERROR,
            'Server error occurred. Please try again later.',
            status,
            undefined,
            data
          );
        }
        
        return new APIError(
          APIErrorType.UNKNOWN_ERROR,
          `Request failed with status ${status}`,
          status,
          undefined,
          data
        );
    }
  }

  static fromNetworkError(error: Error): APIError {
    if (error.name === 'AbortError') {
      return new APIError(
        APIErrorType.TIMEOUT_ERROR,
        'Request timed out. Please check your connection and try again.',
        undefined,
        'TIMEOUT'
      );
    }

    return new APIError(
      APIErrorType.NETWORK_ERROR,
      'Network error occurred. Please check your connection.',
      undefined,
      'NETWORK_ERROR',
      error
    );
  }

  getUserMessage(): string {
    switch (this.type) {
      case APIErrorType.NETWORK_ERROR:
        return 'Unable to connect to the server. Please check your internet connection.';
      
      case APIErrorType.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please check your API credentials.';
      
      case APIErrorType.AUTHORIZATION_ERROR:
        return 'You do not have permission to perform this action.';
      
      case APIErrorType.VALIDATION_ERROR:
        return 'Invalid input data. Please check your request and try again.';
      
      case APIErrorType.NOT_FOUND_ERROR:
        return 'The requested resource was not found.';
      
      case APIErrorType.RATE_LIMIT_ERROR:
        return 'Too many requests. Please wait a moment and try again.';
      
      case APIErrorType.SERVER_ERROR:
        return 'Server error occurred. Please try again later.';
      
      case APIErrorType.TIMEOUT_ERROR:
        return 'Request timed out. Please try again.';
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}