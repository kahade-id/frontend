/**
 * PROTECTED ROUTE WRAPPER
 * 
 * SECURITY FIX [FE-ROUTE-001]: Protected Routes
 * - Ensures user is authenticated before accessing protected pages
 * - Redirects to login if not authenticated
 * - Shows loading state while checking auth
 * - Supports admin-only route protection
 */

import { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner } from '@phosphor-icons/react';

interface ProtectedRouteProps {
 children: ReactNode;
 requireAdmin?: boolean;
 redirectTo?: string;
}

export function ProtectedRoute({
 children,
 requireAdmin = false,
 redirectTo = '/login',
}: ProtectedRouteProps) {
 const { isAuthenticated, isLoading, user } = useAuth();

 // Show loading spinner while checking authentication
 if (isLoading) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background">
 <div className="text-center space-y-4">
 <Spinner className="w-8 h-8 animate-spin text-primary mx-auto" aria-hidden="true" weight="bold" />
 <p className="text-sm text-muted-foreground">Memeriksa autentikasi...</p>
 </div>
 </div>
 );
 }

 // Redirect to login if not authenticated
 if (!isAuthenticated) {
 return <Redirect to={redirectTo} />;
 }

 // Check admin access if required
 if (requireAdmin && !user?.isAdmin) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-4">
 <div className="text-center space-y-4 max-w-md">
 <div className="text-6xl">🔒</div>
 <h1 className="text-2xl font-bold text-foreground">Akses Ditolak</h1>
 <p className="text-muted-foreground">
 Anda tidak memiliki izin untuk mengakses halaman ini.
 Halaman ini hanya dapat diakses oleh administrator.
 </p>
 <a
 href="/"
 className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
 >
 Kembali ke Beranda
 </a>
 </div>
 </div>
 );
 }

 // Render protected content
 return <>{children}</>;
}

/**
 * HOC version for wrapping route components
 * Usage: export default withProtection(MyComponent, { requireAdmin: true })
 */
export function withProtection<P extends object>(
 Component: React.ComponentType<P>,
 options: { requireAdmin?: boolean; redirectTo?: string } = {}
) {
 return function ProtectedComponent(props: P) {
 return (
 <ProtectedRoute requireAdmin={options.requireAdmin} redirectTo={options.redirectTo}>
 <Component {...props} />
 </ProtectedRoute>
 );
 };
}
