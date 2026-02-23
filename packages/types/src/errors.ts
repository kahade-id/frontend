/*
 * COMPREHENSIVE ERROR TYPE DEFINITIONS
 * Replace all 'any' error types with proper TypeScript types
 */

// ApiErrorResponse and ValidationError are defined and exported from './core'.
// Do NOT re-declare them here — duplicate exports via index.ts cause TS2308.

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
      code?: string;
      errors?: Record<string, string[]>;
      statusCode?: number;
    };
    status?: number;
    statusText?: string;
  };
  message?: string;
  code?: string;
}

export type ApiError = Error | AxiosErrorResponse;

// ============================================================================
// FORM ERROR TYPES
// ============================================================================

export interface FormErrorMessage {
  title: string;
  description: string;
  action?: string;
}

// ============================================================================
// GENERIC ERROR HANDLER TYPE
// ============================================================================

export type ErrorHandler = (error: ApiError) => void;

export type ErrorWithMessage = {
  message: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

// ============================================================================
// UTILITY TYPE GUARDS
// ============================================================================

export function isAxiosError(error: unknown): error is AxiosErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  );
}

export function hasErrorMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || ('response' in error && typeof (error as ErrorWithMessage).response === 'object'))
  );
}

export function getErrorMessage(error: unknown): string {
  if (hasErrorMessage(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
}
