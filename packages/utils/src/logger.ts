/**
 * PRODUCTION-SAFE LOGGING UTILITY
 * 
 * CODE QUALITY FIX [FE-CODE-001]: Console Statements
 * 
 * This module provides a production-safe logging system that:
 * - Automatically disables console logs in production
 * - Supports different log levels
 * - Can be integrated with error tracking services (Sentry, etc.)
 * - Preserves full logging in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
 enabled: boolean;
 level: LogLevel;
 prefix?: string;
}

class Logger {
 private config: LoggerConfig;

 constructor(config: Partial<LoggerConfig> = {}) {
 this.config = {
 // Only enable logging in development by default
 enabled: import.meta.env.DEV,
 level: 'debug',
 ...config,
 };
 }

 /**
 * Configure logger settings
 */
 configure(config: Partial<LoggerConfig>): void {
 this.config = { ...this.config, ...config };
 }

 /**
 * Check if logging is enabled for given level
 */
 private shouldLog(level: LogLevel): boolean {
 if (!this.config.enabled) return false;

 const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
 const currentLevelIndex = levels.indexOf(this.config.level);
 const requestedLevelIndex = levels.indexOf(level);

 return requestedLevelIndex >= currentLevelIndex;
 }

 /**
 * Format log message with prefix
 */
 private formatMessage(message: string): string {
 if (this.config.prefix) {
 return `[${this.config.prefix}] ${message}`;
 }
 return message;
 }

 /**
 * Debug level logging - detailed development info
 * Only shown in development mode
 */
 debug(message: string, ...args: any[]): void {
 if (this.shouldLog('debug')) {
 console.log(this.formatMessage(message), ...args);
 }
 }

 /**
 * Info level logging - general information
 */
 info(message: string, ...args: any[]): void {
 if (this.shouldLog('info')) {
 console.info(this.formatMessage(message), ...args);
 }
 }

 /**
 * Warning level logging - potential issues
 */
 warn(message: string, ...args: any[]): void {
 if (this.shouldLog('warn')) {
 console.warn(this.formatMessage(message), ...args);
 }
 }

 /**
 * Error level logging - actual errors
 * Always logged, even in production (for error tracking)
 */
 error(message: string, error?: Error | unknown, ...args: unknown[]): void {
 // Always log errors, even in production
 console.error(this.formatMessage(message), error, ...args);

 // Send to error tracking service in production
 if (!import.meta.env.DEV && error) {
 try {
 // @ts-expect-error - Sentry may not be loaded
 if (typeof window !== 'undefined' && window.Sentry) {
 // @ts-expect-error - Sentry global
 window.Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
 extra: { 
 message, 
 args,
 
 },
 level: 'error',
 });
 }
 } catch (trackingError) {
 // Silently fail if error tracking fails
 console.error('Failed to send error to tracking service:', trackingError);
 }
 }
 }

 /**
 * Performance timing - start timer
 */
 timeStart(label: string): void {
 if (this.shouldLog('debug')) {
 console.time(this.formatMessage(label));
 }
 }

 /**
 * Performance timing - end timer
 */
 timeEnd(label: string): void {
 if (this.shouldLog('debug')) {
 console.timeEnd(this.formatMessage(label));
 }
 }

 /**
 * Group logs together
 */
 group(label: string): void {
 if (this.shouldLog('debug')) {
 console.group(this.formatMessage(label));
 }
 }

 /**
 * End log group
 */
 groupEnd(): void {
 if (this.shouldLog('debug')) {
 console.groupEnd();
 }
 }

 /**
 * Table output for structured data
 */
 table(data: any): void {
 if (this.shouldLog('debug')) {
 console.table(data);
 }
 }
}

// Global logger instance
export const logger = new Logger();

// Domain-specific loggers with prefixes
export const apiLogger = new Logger({ prefix: 'API' });
export const authLogger = new Logger({ prefix: 'Auth' });
export const routeLogger = new Logger({ prefix: 'Route' });
export const performanceLogger = new Logger({ prefix: 'Performance' });

// Export Logger class for custom instances
export { Logger };

/**
 * Development-only assertion
 * Throws error if condition is false, but only in development
 */
export function devAssert(condition: boolean, message: string): asserts condition {
 if (import.meta.env.DEV && !condition) {
 throw new Error(`Assertion failed: ${message}`);
 }
}

/**
 * Log deprecated function usage
 */
export function logDeprecation(oldMethod: string, newMethod: string): void {
 if (import.meta.env.DEV) {
 console.warn(
 `⚠️ Deprecation Warning: ${oldMethod} is deprecated. Use ${newMethod} instead.`
 );
 }
}

/**
 * Safe console replacement for migration
 * Drop-in replacement for console that respects environment
 */
export const safeConsole = {
 log: (...args: any[]) => logger.debug('', ...args),
 info: (...args: any[]) => logger.info('', ...args),
 warn: (...args: any[]) => logger.warn('', ...args),
 error: (...args: any[]) => logger.error('', undefined, ...args),
 debug: (...args: any[]) => logger.debug('', ...args),
 time: (label: string) => logger.timeStart(label),
 timeEnd: (label: string) => logger.timeEnd(label),
 group: (label: string) => logger.group(label),
 groupEnd: () => logger.groupEnd(),
 table: (data: any) => logger.table(data),
};

/**
 * MIGRATION GUIDE
 * 
 * Replace console statements with logger:
 * 
 * Before:
 * console.log('User data:', user);
 * console.error('Failed to fetch:', error);
 * 
 * After:
 * import { logger } from '@kahade/utils';
 * logger.debug('User data:', user);
 * logger.error('Failed to fetch:', error);
 * 
 * Or use safe console (easier migration):
 * import { safeConsole as console } from '@kahade/utils';
 * console.log('User data:', user); // Works the same!
 */
