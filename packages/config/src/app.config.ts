type AppMode = 'landing' | 'app' | 'admin';

export function getAppMode(): AppMode {
  const mode = import.meta.env.VITE_APP_MODE as string;
  if (mode === 'app' || mode === 'admin') {
    return mode;
  }
  return 'landing';
}

// FIX (Issue #4): Removed unsafe `'/api'` relative fallback.
// In production, VITE_API_BASE_URL MUST be set to the real API domain.
// If missing, an error is thrown in production to catch misconfigurations early.
function resolveApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  if (!apiUrl) {
    if (import.meta.env.PROD) {
      // Hard fail in production — never silently use localhost
      throw new Error(
        '[Kahade] VITE_API_BASE_URL is not set. ' +
        'This environment variable is required in production. ' +
        'Set it in your CI/CD secrets or deployment environment.'
      );
    }
    // Development fallback only
    console.warn(
      '[Kahade] VITE_API_BASE_URL not set — using http://localhost:3000/api for development.'
    );
    return 'http://localhost:3000/api';
  }

  return apiUrl;
}

export const APP_URLS = {
  landing: import.meta.env.VITE_LANDING_DOMAIN || '/',
  app: import.meta.env.VITE_APP_DOMAIN || '/dashboard',
  admin: import.meta.env.VITE_ADMIN_DOMAIN || '/admin',
  api: resolveApiUrl(),
};

export function navigateToApp(path: string = '/') {
  window.location.href = APP_URLS.app + path;
}

export function navigateToAdmin(path: string = '/') {
  window.location.href = APP_URLS.admin + path;
}

export function canAccessAdmin(user?: { role?: string; isAdmin?: boolean } | null): boolean {
  if (user) {
    return user.role === 'ADMIN' || user.isAdmin === true;
  }
  return getAppMode() === 'admin';
}
