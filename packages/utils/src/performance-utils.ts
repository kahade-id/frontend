/**
 * PERFORMANCE UTILITIES
 * Helpers for client-side performance optimization.
 */

/**
 * Measure function execution time
 */
export async function measureAsync<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  if (label && import.meta.env.DEV) {
    console.debug(`[Performance] ${label}: ${durationMs.toFixed(2)}ms`);
  }
  return { result, durationMs };
}

/**
 * Request idle callback with fallback
 */
export function requestIdleOrTimeout(
  callback: () => void,
  timeout = 2000
): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 0);
  }
}

/**
 * Lazy load an image, returns a promise that resolves when loaded
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Intersection Observer factory for lazy loading
 */
export function createLazyLoader(
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback(entry);
      }
    });
  }, { rootMargin: '200px', threshold: 0.01, ...options });
}

/**
 * Memoize a pure function with a simple cache
 */
export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  getKey: (...args: TArgs) => string = (...args) => JSON.stringify(args)
): (...args: TArgs) => TReturn {
  const cache = new Map<string, TReturn>();
  return (...args: TArgs): TReturn => {
    const key = getKey(...args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
