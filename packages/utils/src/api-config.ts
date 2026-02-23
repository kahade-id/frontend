/**
 * API CONFIGURATION
 *
 * FIX (Issue V2-2): Removed `http://localhost:3000/api` fallback for
 * staging and production environments. If VITE_API_BASE_URL is not set,
 * production now throws instead of silently hitting localhost.
 *
 * Runtime: Vite/browser build.
 */

type Environment = 'development' | 'staging' | 'production';

function getViteEnv(key: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
  return env?.[key];
}

const DEV_DEFAULTS = {
  apiBaseUrl: 'http://localhost:3000/api',
  wsBaseUrl: 'ws://localhost:3000',
} as const;

export const ApiConfig = {
  /**
   * Resolve API base URL.
   * - Always prefers VITE_API_BASE_URL env var.
   * - Falls back to localhost ONLY in development.
   * - Throws in staging/production if env var is missing.
   */
  apiBaseUrl(env: Environment = 'development'): string {
    const fromEnv = getViteEnv('VITE_API_BASE_URL');

    if (fromEnv) {
      return fromEnv.replace(/\/$/, '');
    }

    if (env === 'production' || env === 'staging') {
      throw new Error(
        `[ApiConfig] VITE_API_BASE_URL is required in ${env} but was not set. ` +
        'Check your CI/CD environment secrets.'
      );
    }

    // Development-only fallback
    return DEV_DEFAULTS.apiBaseUrl;
  },

  /**
   * Resolve WebSocket base URL.
   * - Prefers VITE_WS_BASE_URL.
   * - Falls back to deriving from apiBaseUrl.
   */
  wsBaseUrl(env: Environment = 'development'): string {
    const fromEnv = getViteEnv('VITE_WS_BASE_URL');
    if (fromEnv) return fromEnv.replace(/\/$/, '');

    const api = this.apiBaseUrl(env);
    return api
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      .replace(/\/api$/, '');
  },

  /**
   * Build a full endpoint URL from a path.
   */
  endpoint(path: string, env: Environment = 'development'): string {
    const base = this.apiBaseUrl(env);
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  },
} as const;
