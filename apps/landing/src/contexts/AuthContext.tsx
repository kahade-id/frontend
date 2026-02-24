/**
 * Minimal Auth Context for Landing Page
 * Provides basic authentication state for Navbar (login status, user info)
 * without the full auth flow (handled by dashboard/admin apps).
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { authApi } from '@kahade/utils';
import { SecureStorage } from '@kahade/utils';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isAdmin: boolean;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_CACHE_KEY = 'kahade_user_cache';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Try to restore minimal user from sessionStorage for UI state only
    const cached = sessionStorage.getItem(USER_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setUser({
          id: parsed.id,
          username: parsed.username,
          email: parsed.email,
          role: parsed.role || 'USER',
          isAdmin: parsed.role === 'ADMIN',
        });
      } catch {
        sessionStorage.removeItem(USER_CACHE_KEY);
      }
    }
  }, []);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}