/**
 * KAHADE AUTH CONTEXT - SECURITY ENHANCED & PERFORMANCE OPTIMIZED
 * 
 * SECURITY FIX [FE-SEC-002]: Minimize sensitive data in sessionStorage
 * - Only cache minimal non-sensitive user data for UI
 * - Excluded: phone, avatarUrl, emailVerifiedAt, reputationScore
 * - Included: id, username, email, role, kycStatus (display only)
 * - Full user data fetched from API when needed
 * 
 * SECURITY FIX [C-01]: Migrated from localStorage to HttpOnly cookies
 * - Tokens are now stored in HttpOnly cookies (set by backend)
 * - Frontend only stores minimal non-sensitive user data for UI purposes
 * - CSRF protection via double-submit cookie pattern
 * - XSS attacks cannot steal authentication tokens
 * 
 * PERFORMANCE FIX [P-01]: Optimized re-renders
 * - Memoized expensive functions
 * - Fixed unnecessary API calls
 * - Better state management
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { authApi, logger } from '@kahade/utils';
import { APP_URLS, getAppMode, navigateToApp, navigateToAdmin, canAccessAdmin } from '@kahade/config';
import { SecureStorage } from '@kahade/utils';

// API response user data interface
interface ApiUserData {
 id: string;
 username?: string;
 name?: string;
 email: string;
 phone?: string;
 role?: 'USER' | 'ADMIN';
 isAdmin?: boolean;
 kycStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
 reputationScore?: number | string;
 totalTransactions?: number;
 emailVerifiedAt?: string;
 avatarUrl?: string;
 mfaEnabled?: boolean;
 createdAt: string;
}

interface User {
 id: string;
 username: string;
 email: string;
 phone?: string;
 role: 'USER' | 'ADMIN';
 isAdmin: boolean;
 kycStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
 reputationScore: number;
 totalTransactions: number;
 emailVerifiedAt?: string;
 avatarUrl?: string;
 mfaEnabled?: boolean;
 createdAt: string;
}

/**
 * SECURITY FIX [FE-SEC-002]: Minimal cached user data
 * Only cache absolutely necessary fields for UI display
 * Sensitive data (phone, avatar, etc.) must be fetched via API
 */
interface CachedUserData {
 id: string;
 username: string;
 email: string;
 role: 'USER' | 'ADMIN';
 kycStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
}

interface AuthContextType {
 user: User | null;
 isLoading: boolean;
 isAuthenticated: boolean;
 login: (email: string, password: string) => Promise<User>;
 register: (data: RegisterData) => Promise<void>;
 logout: () => Promise<void>;
 updateUser: (user: User) => void;
 refreshUser: () => Promise<void>;
}

interface RegisterData {
 email: string;
 username: string;
 password: string;
 phone?: string;
 referralCode?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// SECURITY FIX [FE-SEC-002]: Use sessionStorage for minimal non-sensitive user data only
const USER_CACHE_KEY = 'kahade_user_cache';

/**
 * SECURITY FIX [FE-SEC-002]: Extract only minimal safe data for caching
 * Excludes sensitive fields like phone, avatar URL, email verification status
 */
function getSafeCacheData(user: User): CachedUserData {
 return {
 id: user.id,
 username: user.username,
 email: user.email,
 role: user.role,
 kycStatus: user.kycStatus,
 };
}

/**
 * SECURITY FIX [FE-SEC-002]: Restore full user object from cached minimal data
 * Missing fields will be loaded from API when component needs them
 */
function restoreUserFromCache(cached: CachedUserData): User {
 return {
 id: cached.id,
 username: cached.username,
 email: cached.email,
 role: cached.role,
 isAdmin: cached.role === 'ADMIN',
 kycStatus: cached.kycStatus,
 // Default values for fields not cached
 reputationScore: 0,
 totalTransactions: 0,
 mfaEnabled: false,
 createdAt: new Date().toISOString(),
 };
}

export function AuthProvider({ children }: { children: ReactNode }) {
 const [user, setUser] = useState<User | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 // PERFORMANCE FIX [P-01]: Memoize mapUserData to prevent recreating on every render
 const mapUserData = useCallback((userData: ApiUserData, defaultUsername?: string): User => {
 return {
 id: userData.id,
 username: userData.username || userData.name || defaultUsername || userData.email?.split('@')[0] || 'user',
 email: userData.email,
 phone: userData.phone,
 role: userData.role || 'USER',
 isAdmin: userData.role === 'ADMIN' || userData.isAdmin === true,
 kycStatus: userData.kycStatus || 'NONE',
 reputationScore: Number(userData.reputationScore) || 0,
 totalTransactions: userData.totalTransactions || 0,
 emailVerifiedAt: userData.emailVerifiedAt,
 avatarUrl: userData.avatarUrl,
 mfaEnabled: userData.mfaEnabled || false,
 createdAt: userData.createdAt,
 };
 }, []);

 // PERFORMANCE FIX [P-01]: Memoize fetchCurrentUser
 const fetchCurrentUser = useCallback(async () => {
 try {
 // SECURITY FIX [C-01]: API calls now use cookies automatically (withCredentials: true)
 const response = await authApi.me();
 const userData = response.data.user || response.data;
 const mappedUser = mapUserData(userData);
 setUser(mappedUser);
 
 // SECURITY FIX [FE-SEC-002]: Cache only minimal safe data
 const safeCache = getSafeCacheData(mappedUser);
 sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(safeCache));
 
 return mappedUser;
 } catch (error) {
 // SECURITY FIX [C-01]: Clear cached user data on auth failure
 sessionStorage.removeItem(USER_CACHE_KEY);
 SecureStorage.clearAll();
 setUser(null);
 throw error;
 }
 }, [mapUserData]);

 // PERFORMANCE FIX [P-01]: Run auth check only once on mount
 useEffect(() => {
 let mounted = true;

 const checkAuth = async () => {
 if (!mounted) return;

 const appMode = getAppMode();
 
 // SECURITY FIX [FE-SEC-002]: Check cached minimal user data for faster initial render
 // Actual authentication is verified via HttpOnly cookie on API call
 const cachedData = sessionStorage.getItem(USER_CACHE_KEY);
 if (cachedData && mounted) {
 try {
 const cached: CachedUserData = JSON.parse(cachedData);
 // Restore user from minimal cached data
 setUser(restoreUserFromCache(cached));
 } catch (e) {
 sessionStorage.removeItem(USER_CACHE_KEY);
 }
 }
 
 // Ensure CSRF token is available for subdomain API calls
 if (!SecureStorage.getCsrfToken()) {
 try {
 await authApi.csrf();
 } catch (error) {
 // Ignore CSRF seed failure; requests may still succeed if token exists in cookies
 }
 }

 // On landing page without cached user, skip API call to avoid unnecessary 401 errors
 if (appMode === 'landing' && !cachedData) {
 if (mounted) setIsLoading(false);
 return;
 }
 
 // SECURITY FIX [C-01]: Verify authentication via API call
 try {
 await fetchCurrentUser();
 } catch (error) {
 // User is not authenticated or session expired - silent fail
 }
 
 if (mounted) setIsLoading(false);
 };
 
 checkAuth();

 return () => {
 mounted = false;
 };
 }, [fetchCurrentUser]);

 const login = useCallback(async (email: string, password: string): Promise<User> => {
 setIsLoading(true);
 try {
 // SECURITY FIX [C-01]: Backend now sets tokens in HttpOnly cookies
 const appMode = getAppMode();
 const response =
 appMode === 'admin'
 ? await authApi.adminLogin({ email, password })
 : await authApi.login({ email, password });
 const { user: userData } = response.data;
 
 let mappedUser: User;
 if (userData) {
 mappedUser = mapUserData(userData, email.split('@')[0]);
 setUser(mappedUser);
 
 // SECURITY FIX [FE-SEC-002]: Cache only minimal safe data
 const safeCache = getSafeCacheData(mappedUser);
 sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(safeCache));
 } else {
 mappedUser = await fetchCurrentUser();
 }
 
 // Redirect based on app mode and user role
 if (appMode === 'landing') {
 if (canAccessAdmin(mappedUser)) {
 navigateToAdmin();
 } else {
 navigateToApp();
 }
 } else if (appMode === 'admin') {
 window.location.href = '/';
 }
 
 return mappedUser;
 } catch (error) {
 // SECURITY FIX [FE-SEC-002]: Clear any cached data on login failure
 sessionStorage.removeItem(USER_CACHE_KEY);
 SecureStorage.clearAll();
 throw error;
 } finally {
 setIsLoading(false);
 }
 }, [mapUserData, fetchCurrentUser]);

 const register = useCallback(async (data: RegisterData) => {
 setIsLoading(true);
 try {
 // SECURITY FIX [C-01]: Backend now sets tokens in HttpOnly cookies
 const response = await authApi.register({
 email: data.email,
 username: data.username,
 password: data.password,
 phone: data.phone,
 referralCode: data.referralCode,
 });
 
 const { user: userData } = response.data;
 
 if (userData) {
 const mappedUser = mapUserData(userData, data.username);
 if (data.phone) mappedUser.phone = data.phone;
 setUser(mappedUser);
 
 // SECURITY FIX [FE-SEC-002]: Cache only minimal safe data
 const safeCache = getSafeCacheData(mappedUser);
 sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(safeCache));
 } else {
 await fetchCurrentUser();
 }
 
 // Redirect to app after registration
 const appMode = getAppMode();
 if (appMode === 'landing') {
 navigateToApp();
 }
 } catch (error) {
 throw error;
 } finally {
 setIsLoading(false);
 }
 }, [mapUserData, fetchCurrentUser]);

 const logout = useCallback(async () => {
 try {
 // SECURITY FIX [C-01]: Backend will clear HttpOnly cookies
 await authApi.logout();
 } catch (error) {
 // FIX (Issue V2-5): Log in dev instead of swallowing silently.
 // Logout API failing is non-fatal — local state is always cleared.
 if (import.meta.env.DEV) {
  logger.warn('Logout API call failed (non-fatal):', error);
 }
 } finally {
 // SECURITY FIX [FE-SEC-002]: Clear all cached data
 sessionStorage.removeItem(USER_CACHE_KEY);
 SecureStorage.clearAll();
 
 setUser(null);
 
 // Redirect to landing page after logout
 const appMode = getAppMode();
 if (appMode !== 'landing') {
 window.location.href = APP_URLS.landing;
 }
 }
 }, []);

 const updateUser = useCallback((updatedUser: User) => {
 setUser(updatedUser);
 
 // SECURITY FIX [FE-SEC-002]: Cache only minimal safe data
 const safeCache = getSafeCacheData(updatedUser);
 sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(safeCache));
 }, []);

 const refreshUser = useCallback(async () => {
 try {
 await fetchCurrentUser();
 } catch (error) {
 // FIX (Issue V2-5): Log in dev instead of swallowing silently.
 // refreshUser failure is non-fatal (e.g. session expired).
 if (import.meta.env.DEV) {
  logger.warn('Failed to refresh user session:', error);
 }
 }
 }, [fetchCurrentUser]);

 // PERFORMANCE FIX [P-01]: Memoize context value to prevent unnecessary re-renders
 const contextValue = useMemo(
 () => ({
 user,
 isLoading,
 isAuthenticated: !!user,
 login,
 register,
 logout,
 updateUser,
 refreshUser,
 }),
 [user, isLoading, login, register, logout, updateUser, refreshUser]
 );

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
