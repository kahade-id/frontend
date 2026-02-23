/**
 * COMPREHENSIVE ERROR TYPE DEFINITIONS
 * Replace all 'any' error types with proper TypeScript types
 */

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface ApiErrorResponse {
 message: string;
 code?: string;
 errors?: Record<string, string[]>;
 statusCode?: number;
}

export interface AxiosErrorResponse {
 response?: {
 data?: ApiErrorResponse | { message?: string };
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
// VALIDATION ERROR TYPES
// ============================================================================

export interface ValidationError {
 field: string;
 message: string;
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
