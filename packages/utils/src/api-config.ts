/**
 * API CONFIGURATION
 *
 * Production-safe API configuration for all frontends.
 * - Uses Vite env var: VITE_API_BASE_URL
 * - No hardcoded production domains
 *
 * NOTE:
 * - For staging/prod, set VITE_API_BASE_URL in CI/CD secrets or runtime env.
 * - Fallback is localhost for dev.
 */

type Environment = "development" | "staging" | "production";

/**
 * Safe env reader (works in Vite/browser builds).
 */
function getViteEnv(key: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
  return env?.[key];
}

const DEFAULTS = {
  development: {
    apiBaseUrl: "http://localhost:3000/api",
    wsBaseUrl: "ws://localhost:3000",
  },
  staging: {
    apiBaseUrl: "http://localhost:3000/api",
    wsBaseUrl: "ws://localhost:3000",
  },
  production: {
    apiBaseUrl: "http://localhost:3000/api",
    wsBaseUrl: "ws://localhost:3000",
  },
} as const;

export const ApiConfig = {
  /**
   * Resolve API base URL from env (preferred) or defaults.
   */
  apiBaseUrl(env: Environment = "development"): string {
    return (getViteEnv("VITE_API_BASE_URL") ?? DEFAULTS[env].apiBaseUrl).replace(/\/$/, "");
  },

  /**
   * Resolve WebSocket base URL from env or derive from API base URL.
   */
  wsBaseUrl(env: Environment = "development"): string {
    const fromEnv = getViteEnv("VITE_WS_BASE_URL");
    if (fromEnv) return fromEnv.replace(/\/$/, "");

    const api = this.apiBaseUrl(env);
    // Derive ws url from api url: http(s)://host/api -> ws(s)://host
    return api
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/api$/, "");
  },

  /**
   * Build a full endpoint URL from a path.
   */
  endpoint(path: string, env: Environment = "development"): string {
    const base = this.apiBaseUrl(env);
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${cleanPath}`;
  },
} as const;
