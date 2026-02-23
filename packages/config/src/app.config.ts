type AppMode = 'landing' | 'app' | 'admin';

export function getAppMode(): AppMode {
 const mode = import.meta.env.VITE_APP_MODE as string;
 if (mode === 'app' || mode === 'admin') {
 return mode;
 }
 return 'landing';
}

export const APP_URLS = {
 landing: import.meta.env.VITE_LANDING_DOMAIN || '/',
 app: import.meta.env.VITE_APP_DOMAIN || '/dashboard',
 admin: import.meta.env.VITE_ADMIN_DOMAIN || '/admin',
 api: import.meta.env.VITE_API_BASE_URL || '/api',
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
