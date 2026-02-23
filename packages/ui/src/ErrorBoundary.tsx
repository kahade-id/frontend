import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error Boundary Props
 */
export interface ErrorBoundaryProps {
 children: ReactNode;
 fallback?: ReactNode;
 onError?: (error: Error, errorInfo: ErrorInfo) => void;
 resetOnPropsChange?: unknown[];
}

/**
 * Error Boundary State
 */
interface State {
 hasError: boolean;
 error: Error | null;
 errorInfo: ErrorInfo | null;
 errorCount: number;
}

/**
 * Comprehensive Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 * 
 * Features:
 * - User-friendly error UI
 * - Error recovery mechanism
 * - Automatic error reporting
 * - Development vs production mode
 * - Reset functionality
 * - Error tracking integration
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 * <YourComponent />
 * </ErrorBoundary>
 * ```
 * 
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary
 * fallback={<CustomErrorUI />}
 * onError={(error, info) => logErrorToService(error, info)}
 * >
 * <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
 constructor(props: ErrorBoundaryProps) {
 super(props);
 this.state = {
 hasError: false,
 error: null,
 errorInfo: null,
 errorCount: 0,
 };
 }

 /**
 * Update state when error is caught
 */
 static getDerivedStateFromError(error: Error): Partial<State> {
 return {
 hasError: true,
 error,
 };
 }

 /**
 * Log error details
 */
 componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
 const { onError } = this.props;
 const { errorCount } = this.state;

 // Update state with error details
 this.setState({
 errorInfo,
 errorCount: errorCount + 1,
 });

 // Log to console in development
 if (process.env.NODE_ENV === 'development') {
 }

 // Call custom error handler
 if (onError) {
 onError(error, errorInfo);
 }

 // Send to error tracking service (e.g., Sentry)
 this.reportError(error, errorInfo);
 }

 /**
 * Reset error boundary on props change
 */
 componentDidUpdate(prevProps: ErrorBoundaryProps): void {
 const { resetOnPropsChange } = this.props;
 const { hasError } = this.state;

 if (
 hasError &&
 resetOnPropsChange &&
 resetOnPropsChange.some(
 (prop, index) => prop !== prevProps.resetOnPropsChange?.[index]
 )
 ) {
 this.resetError();
 }
 }

 /**
 * Report error to monitoring service
 */
 private reportError(error: Error, errorInfo: ErrorInfo): void {
 // Prepare error report data
 const errorReport = {
 message: error.message,
 stack: error.stack,
 componentStack: errorInfo.componentStack,
 timestamp: new Date().toISOString(),
 userAgent: navigator.userAgent,
 url: window.location.href,
 };

 // Log to console in development
 if (import.meta.env.DEV) {
 console.error('Error Boundary Report:', errorReport);
 return;
 }

 // Send to Sentry if available
 try {
 // @ts-expect-error - Sentry may not be loaded
 if (typeof window !== 'undefined' && window.Sentry) {
 // @ts-expect-error - Sentry global
 window.Sentry.captureException(error, {
 contexts: {
 react: {
 componentStack: errorInfo.componentStack,
 },
 },
 tags: {
 errorBoundary: true,
 },
 });
 }
 } catch (trackingError) {
 // Silently fail if error tracking fails
 console.error('Failed to send error to Sentry:', trackingError);
 }
 }

 /**
 * Reset error state
 */
 private resetError = (): void => {
 this.setState({
 hasError: false,
 error: null,
 errorInfo: null,
 });
 };

 /**
 * Reload page (last resort)
 */
 private reloadPage = (): void => {
 window.location.reload();
 };

 /**
 * Render fallback UI or children
 */
 render(): ReactNode {
 const { hasError, error, errorInfo, errorCount } = this.state;
 const { children, fallback } = this.props;

 if (hasError) {
 // Use custom fallback if provided
 if (fallback) {
 return fallback;
 }

 // Default error UI
 return (
 <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
 <div className="w-full max-w-md rounded-lg bg-white p-8 ">
 {/* Error Icon */}
 <div className="mb-4 flex justify-center">
 <div className="rounded-full bg-red-100 p-3">
 <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
 </div>
 </div>

 {/* Error Message */}
 <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
 Oops! Terjadi Kesalahan
 </h1>
 <p className="mb-6 text-center text-gray-600">
 Maaf, terjadi kesalahan yang tidak terduga. Tim kami telah
 diberitahu dan sedang menangani masalah ini.
 </p>

 {/* Error Details (Development Only) */}
 {process.env.NODE_ENV === 'development' && error && (
 <div className="mb-6 rounded-md bg-gray-100 p-4">
 <h3 className="mb-2 text-sm font-semibold text-gray-700">
 Error Details (Dev Mode)
 </h3>
 <p className="mb-2 text-xs text-red-600">{error.message}</p>
 {errorInfo && (
 <details className="text-xs text-gray-600">
 <summary className="cursor-pointer font-medium">
 Component Stack
 </summary>
 <pre className="mt-2 overflow-auto">
 {errorInfo.componentStack}
 </pre>
 </details>
 )}
 </div>
 )}

 {/* Action Buttons */}
 <div className="space-y-3">
 {/* Try Again */}
 <button
 onClick={this.resetError}
 className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
 >
 <RefreshCw className="h-5 w-5" aria-hidden="true" />
 Coba Lagi
 </button>

 {/* Reload Page (if error persists) */}
 {errorCount > 1 && (
 <button
 onClick={this.reloadPage}
 className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
 >
 Muat Ulang Halaman
 </button>
 )}

 {/* Go Home */}
 <a
 href="/"
 className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
 >
 Kembali ke Beranda
 </a>
 </div>

 {/* Support Link */}
 <p className="mt-6 text-center text-sm text-gray-500">
 Masih mengalami masalah?{' '}
 <a
 href="/help"
 className="font-medium text-primary hover:text-primary-dark"
 >
 Hubungi Support
 </a>
 </p>
 </div>
 </div>
 );
 }

 return children;
 }
}

/**
 * HOC to wrap component with Error Boundary
 * 
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 * fallback: <ErrorUI />,
 * onError: (error) => logError(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
 Component: React.ComponentType<P>,
 errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
 return (props: P) => (
 <ErrorBoundary {...errorBoundaryProps}>
 <Component {...props} />
 </ErrorBoundary>
 );
}

/**
 * Hook for handling async errors in functional components
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 * const handleError = useErrorHandler();
 * 
 * const fetchData = async () => {
 * try {
 * await api.getData();
 * } catch (error) {
 * handleError(error);
 * }
 * };
 * }
 * ```
 */
export function useErrorHandler(): (error: Error) => void {
 const [, setError] = React.useState();
 
 return React.useCallback(
 (error: Error) => {
 setError(() => {
 throw error;
 });
 },
 []
 );
}

export default ErrorBoundary;
