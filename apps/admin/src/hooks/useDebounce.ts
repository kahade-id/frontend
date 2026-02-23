import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// USE DEBOUNCE HOOK
// Provides debounced values and callbacks for performance optimization
// ============================================================================

/**
 * Debounce a value - useful for search inputs
 * @param value The value to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
 const [debouncedValue, setDebouncedValue] = useState<T>(value);

 useEffect(() => {
 const timer = setTimeout(() => {
 setDebouncedValue(value);
 }, delay);

 return () => {
 clearTimeout(timer);
 };
 }, [value, delay]);

 return debouncedValue;
}

/**
 * Debounce a callback function
 * @param callback The function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
 callback: T,
 delay: number = 300,
): T {
 const callbackRef = useRef<T>(callback);
 const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

 useEffect(() => {
 callbackRef.current = callback;
 }, [callback]);

 useEffect(() => {
 return () => {
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }
 };
 }, []);

 const debouncedCallback = useCallback(
 (...args: Parameters<T>) => {
 if (timeoutRef.current) {
 clearTimeout(timeoutRef.current);
 }

 timeoutRef.current = setTimeout(() => {
 callbackRef.current(...args);
 }, delay);
 },
 [delay],
 ) as T;

 return debouncedCallback;
}

/**
 * Debounce a value with pending state indicator
 * @param value The value to debounce
 * @param delay Delay in milliseconds
 * @returns Object with debounced value and pending state
 */
export function useDebounceWithPending<T>(
 value: T,
 delay: number = 300,
): { debouncedValue: T; isPending: boolean } {
 const [debouncedValue, setDebouncedValue] = useState<T>(value);
 const [isPending, setIsPending] = useState(false);

 useEffect(() => {
 setIsPending(true);

 const timer = setTimeout(() => {
 setDebouncedValue(value);
 setIsPending(false);
 }, delay);

 return () => {
 clearTimeout(timer);
 };
 }, [value, delay]);

 return { debouncedValue, isPending };
}

export default useDebounce;
