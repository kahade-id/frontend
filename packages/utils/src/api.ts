/*
 * KAHADE API SERVICE - SECURITY ENHANCED
 * 
 * SECURITY FIX [C-01]: Migrated from localStorage to HttpOnly cookies
 * - JWT tokens are now stored in HttpOnly cookies (set by backend)
 * - Frontend no longer handles or stores authentication tokens
 * - CSRF protection via double-submit cookie pattern
 * - XSS attacks cannot steal authentication tokens
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { APP_URLS } from '@kahade/config';
import type { DisputeReason, EvidenceType } from '@kahade/types';
import type { 
 AdminUserUpdate, 
 PlatformSettingsUpdate, 
 CreatePromoData, 
 UpdatePromoData 
} from '@kahade/types';
import { SecureStorage } from '@kahade/utils';
import { apiLogger } from './logger';

// Base API URL - from centralized config
const API_BASE_URL = APP_URLS.api;

// Request timeout - reduced from 30s to 15s for better UX
const REQUEST_TIMEOUT = 15000;

// SECURITY FIX [C-01]: Removed token storage keys - tokens now in HttpOnly cookies
const USER_CACHE_KEY = 'kahade_user_cache';

// Create axios instance with default config
const api = axios.create({
 baseURL: API_BASE_URL,
 headers: {
 'Content-Type': 'application/json',
 },
 timeout: REQUEST_TIMEOUT,
 withCredentials: true, // SECURITY FIX [C-01]: Enable cookies for HttpOnly token handling
});

let csrfSeedPromise: Promise<void> | null = null;

async function ensureCsrfSeeded(): Promise<void> {
 if (csrfSeedPromise) {
 return csrfSeedPromise;
 }

 csrfSeedPromise = authApi
 .csrf()
 .then(() => undefined)
 .catch(() => undefined)
 .finally(() => {
 csrfSeedPromise = null;
 });

 return csrfSeedPromise;
}

// Generate unique request ID for tracing
function generateRequestId(): string {
 return crypto.randomUUID();
}

// Request interceptor to add security headers
api.interceptors.request.use(
 async (config) => {
 // SECURITY FIX [C-01]: Removed Authorization header handling
 // Tokens are now sent automatically via HttpOnly cookies

 // Add CSRF token for protection against CSRF attacks
 const isStateChanging = ['post', 'put', 'patch', 'delete'].includes(
 config.method?.toLowerCase() || ''
 );

 if (isStateChanging && !SecureStorage.getCsrfToken()) {
 await ensureCsrfSeeded();
 }

 const csrfToken = SecureStorage.getCsrfToken();
 if (csrfToken) {
 config.headers['x-xsrf-token'] = csrfToken;
 }

 // Add request ID for tracing
 config.headers['X-Request-ID'] = generateRequestId();

 // Add idempotency key for POST/PUT/PATCH requests (financial operations)
 if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
 const isFinancialEndpoint = 
 config.url?.includes('/wallet/') ||
 config.url?.includes('/transactions/') ||
 config.url?.includes('/withdraw') ||
 config.url?.includes('/topup');
 
 if (isFinancialEndpoint && !config.headers['X-Idempotency-Key']) {
 config.headers['X-Idempotency-Key'] = generateRequestId();
 }
 }

 return config;
 },
 (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
 (response: AxiosResponse) => {
 // SECURITY FIX [C-01]: Store CSRF token from response header
 const csrfToken = response.headers['x-csrf-token'];
 if (csrfToken) {
 SecureStorage.setCsrfToken(csrfToken);
 }
 return response;
 },
 async (error: AxiosError) => {
 const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

 // Handle 401 Unauthorized
 if (error.response?.status === 401) {
 // SECURITY FIX [C-01]: Try to refresh token via API call
 // Backend will handle token refresh via HttpOnly cookies
 if (!originalRequest._retry) {
 originalRequest._retry = true;
 
 try {
 // Attempt to refresh the session
 await authApi.refreshToken();
 // Retry the original request
 return api(originalRequest);
 } catch (refreshError) {
 // Refresh failed, clear cached data and redirect
 clearAuth();
 redirectToLogin();
 }
 } else {
 clearAuth();
 redirectToLogin();
 }
 }

 // Handle 403 Forbidden
 if (error.response?.status === 403) {
 console.error('Access forbidden:', error.response.data);
 }

 // Handle 429 Too Many Requests
 if (error.response?.status === 429) {
 console.error('Rate limit exceeded. Please wait before trying again.');
 }

 // Handle 500 Internal Server Error
 if (error.response?.status && error.response.status >= 500) {
 console.error('Server error:', error.response.data);
 }

 return Promise.reject(error);
 }
);

// SECURITY FIX [C-01]: Clear only cached user data (tokens are in HttpOnly cookies)
function clearAuth(): void {
 sessionStorage.removeItem(USER_CACHE_KEY);
 SecureStorage.clearAll();
}

function redirectToLogin(): void {
 // Don't redirect if already on login/register page
 if (window.location.pathname.includes('/login') || 
 window.location.pathname.includes('/register')) {
 return;
 }
 
 // Don't redirect if on landing page (non-protected routes)
 const hostname = window.location.hostname;
 const isLandingDomain = !hostname.startsWith('app.') && !hostname.startsWith('admin.');
 
 if (isLandingDomain) {
 // On landing page, don't auto-redirect - let user browse freely
 return;
 }
 
 // Redirect to /login on current origin (each subdomain has its own login page)
 window.location.href = '/login';
}

// Auth API
export const authApi = {
 login: (data: { email: string; password: string; mfaCode?: string }) =>
 api.post('/auth/login', data),
 adminLogin: (data: { email: string; password: string; mfaCode?: string }) =>
 api.post('/auth/admin/login', data),
 csrf: () => api.get('/auth/csrf'),
 
 register: (data: { email: string; password: string; username: string; phone?: string; referralCode?: string }) =>
 api.post('/auth/register', data),
 
 forgotPassword: (email: string) =>
 api.post('/auth/forgot-password', { email }),
 
 resetPassword: (data: { token: string; password: string }) =>
 api.post('/auth/reset-password', data),
 
 validateResetToken: (token: string) =>
 api.get(`/auth/reset-password/validate?token=${token}`),
 
 changePassword: (data: { currentPassword: string; newPassword: string }) =>
 api.post('/auth/change-password', data),
 
 verifyEmail: (token: string) =>
 api.post('/auth/verify-email', { token }),
 
 resendVerification: () =>
 api.post('/auth/resend-verification'),
 
 me: () => api.get('/auth/me'),
 
 // SECURITY FIX [C-01]: Logout now handled via API call
 // Backend will clear HttpOnly cookies
 logout: () => api.post('/auth/logout'),
 
 logoutAll: () => api.post('/auth/logout-all'),
 
 // SECURITY FIX [C-01]: Token refresh handled via HttpOnly cookies
 refreshToken: () => api.post('/auth/refresh'),
 
 // 2FA (MFA TOTP)
 enable2FA: () => api.post('/auth/mfa/totp/setup'),
 
 disable2FA: (data: { code: string; method?: string }) => 
 api.post('/auth/mfa/disable', data),
 
 verify2FA: (code: string) => api.post('/auth/mfa/totp/confirm', { code }),
 
 // Sessions
 getSessions: () => api.get('/auth/sessions'),
 
 revokeSession: (sessionId: string) => 
 api.delete(`/auth/sessions/${sessionId}`),
 
 revokeAllSessions: () => api.delete('/auth/sessions'),
};

// User API
export const userApi = {
 getProfile: () => api.get('/user/profile'),
 
 updateProfile: (data: { username?: string; phone?: string }) =>
 api.patch('/user/profile', data),
 
 changePassword: (data: { currentPassword: string; newPassword: string }) =>
 api.post('/user/change-password', data),
 
 uploadAvatar: (data: FormData) =>
 api.post('/user/avatar', data, {
 headers: { 'Content-Type': 'multipart/form-data' },
 }),
 
 uploadKYC: (data: FormData) =>
 api.post('/kyc/submit', data, {
 headers: { 'Content-Type': 'multipart/form-data' },
 }),
 
 getKYCStatus: () => api.get('/kyc/status'),
 
 getStats: () => api.get('/user/stats'),
 
 updateNotificationSettings: (data: {
 email?: boolean;
 push?: boolean;
 transaction?: boolean;
 marketing?: boolean;
 }) => api.patch('/user/notification-settings', data),
 
 getPublicProfile: (userId: string) => api.get(`/users/${userId}`),
 
 getRatings: (userId: string) => api.get(`/users/${userId}/ratings`),
 
 requestDataExport: () => api.post('/user/data-export'),
 
 deleteAccount: (password: string) => api.delete('/user/account', { data: { password } }),
};

// Transaction API
export const transactionApi = {
 list: (params?: { status?: string; role?: string; page?: number; limit?: number }) =>
 api.get('/transactions', { params }),
 
 get: (id: string) => api.get(`/transactions/${id}`),
 
 create: (data: {
 counterpartyEmail?: string;
 counterpartyId?: string;
 role: 'buyer' | 'seller';
 title: string;
 description: string;
 category: string;
 amount: number;
 feePaidBy: 'buyer' | 'seller' | 'split';
 terms?: string;
 }) => api.post('/transactions', data),

 getInvite: (token: string) => api.get(`/transactions/invite/${token}`),

 acceptInvite: (inviteToken: string, message?: string) =>
 api.post('/transactions/accept', { inviteToken, message }),
 
 accept: (id: string) => api.post(`/transactions/${id}/accept`),
 
 reject: (id: string, reason?: string) =>
 api.post(`/transactions/${id}/reject`, { reason }),
 
 pay: (id: string) => api.post(`/transactions/${id}/pay`),
 
 confirmDelivery: (id: string, proofUrl?: string) =>
 api.post(`/transactions/${id}/deliver`, { proofUrl }),
 
 confirmReceipt: (id: string) =>
 api.post(`/transactions/${id}/complete`),
 
 dispute: (id: string, data: { reason: string; description: string }) =>
 api.post(`/transactions/${id}/dispute`, data),
 
 cancel: (id: string, reason?: string) =>
 api.post(`/transactions/${id}/cancel`, { reason }),
 
 getTimeline: (id: string) => api.get(`/transactions/${id}/timeline`),
 
 addMessage: (id: string, message: string) =>
 api.post(`/transactions/${id}/messages`, { message }),
 
 getMessages: (id: string) => api.get(`/transactions/${id}/messages`),
 
 // Delivery proof
 submitDeliveryProof: (id: string, data: {
 courier?: string;
 trackingNumber?: string;
 notes?: string;
 fileUrls?: string[];
 file?: File;
 }) => {
 if (data.file) {
 const formData = new FormData();
 formData.append('file', data.file);
 if (data.courier) formData.append('courier', data.courier);
 if (data.trackingNumber) formData.append('trackingNumber', data.trackingNumber);
 if (data.notes) formData.append('notes', data.notes);
 if (data.fileUrls?.length) {
 data.fileUrls.forEach((url) => formData.append('fileUrls', url));
 }
 return api.post(`/transactions/${id}/delivery-proof`, formData);
 }
 return api.post(`/transactions/${id}/delivery-proof`, data);
 },
 
 getDeliveryProof: (id: string) => api.get(`/transactions/${id}/delivery-proof`),
 
 // Rating
 submitRating: (id: string, data: { score: number; comment?: string }) =>
 api.post(`/transactions/${id}/rating`, data),
 
 getRatings: (id: string) => api.get(`/transactions/${id}/ratings`),
 
 // Validate counterparty email
 validateCounterparty: (email: string) =>
 api.get('/users/validate-email', { params: { email } }),
};

// Wallet API
export const walletApi = {
 // Get wallet balance
 getBalance: () => api.get('/wallet/balance'),
 
 // Get detailed wallet balance including locked funds
 getDetailedBalance: () => api.get('/wallet/balance/detailed'),
 
 // Get wallet transactions history
 getTransactions: (params?: { type?: string; page?: number; limit?: number }) =>
 api.get('/wallet/transactions', { params }),
 
 // Top up wallet balance
 topUp: (data: { amount: number; method: string }) =>
 api.post('/wallet/topup', data),
 
 // Withdraw using saved bank account ID
 withdraw: (
 data: { amountMinor: number; bankAccountId: string },
 options?: { mfaToken?: string; idempotencyKey?: string },
 ) =>
 // Wallet withdraw endpoint requires idempotency header to prevent duplicate payouts
 api.post('/wallet/withdraw', data, {
 headers: {
 ...(options?.mfaToken ? { 'x-mfa-token': options.mfaToken } : {}),
 'x-idempotency-key': options?.idempotencyKey ?? `wd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
 },
 }),
 
 // Backwards-compatible alias for saved bank account withdrawals
 withdrawWithBankAccount: (
 data: { amountMinor: number; bankAccountId: string },
 options?: { mfaToken?: string; idempotencyKey?: string },
 ) =>
 api.post('/wallet/withdraw', data, {
 headers: {
 ...(options?.mfaToken ? { 'x-mfa-token': options.mfaToken } : {}),
 'x-idempotency-key': options?.idempotencyKey ?? `wd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
 },
 }),
 
 // Cancel pending withdrawal
 cancelWithdrawal: (withdrawalId: string) =>
 api.post(`/wallet/withdrawals/${withdrawalId}/cancel`),
 
 // Get list of supported banks
 getBanks: () => api.get('/wallet/banks'),
 
 // Get withdrawal history
 getWithdrawals: (params?: { status?: string; page?: number; limit?: number }) => 
 api.get('/wallet/withdrawals', { params }),
 
 // Get deposit history
 getDeposits: (params?: { status?: string; page?: number; limit?: number }) =>
 api.get('/wallet/deposits', { params }),
 
 // Get single deposit detail
 getDeposit: (depositId: string) =>
 api.get(`/wallet/deposits/${depositId}`),
 
 // Get single withdrawal detail
 getWithdrawal: (withdrawalId: string) =>
 api.get(`/wallet/withdrawals/${withdrawalId}`),
};

// Bank Account API
export const bankAccountApi = {
 // Get list of user's bank accounts
 list: () => api.get('/bank/accounts'),
 
 // Get single bank account by ID
 get: (id: string) => api.get(`/bank/accounts/${id}`),
 
 // Add new bank account
 create: (data: { bankCode: string; accountNumber: string; accountHolderName: string }) =>
 api.post('/bank/accounts', data),
 
 // Delete bank account
 delete: (id: string) => api.delete(`/bank/accounts/${id}`),
 
 // Set bank account as default
 setDefault: (id: string) => api.patch(`/bank/accounts/${id}/default`),
 
 // Request bank account verification
 verify: (id: string) => api.post(`/bank/accounts/${id}/verify`),
 
 // Get list of supported banks
 getSupportedBanks: () => api.get('/bank/list'),
 
 // Get withdrawals for a specific bank account
 getWithdrawals: (id: string, params?: { page?: number; limit?: number }) =>
 api.get(`/bank/accounts/${id}/withdrawals`, { params }),
};

// Notification API
export const notificationApi = {
 list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
 api.get('/notifications', { params }),
 
 markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
 markAllAsRead: () => api.patch('/notifications/read-all'),
 
 getUnreadCount: () => api.get('/notifications/unread-count'),
 
 delete: (id: string) => api.delete(`/notifications/${id}`),
};

// Dispute API
export const disputeApi = {
 list: (params?: { status?: string; page?: number; limit?: number }) =>
 api.get('/disputes/my', { params }),
 get: (id: string) => api.get(`/disputes/${id}`),
 
 create: (data: { orderId: string; reason: DisputeReason; description: string }) =>
 api.post('/disputes', data),
 
 sendMessage: (id: string, message: string) =>
 api.post(`/disputes/${id}/messages`, { message }),
 
 getMessages: (id: string) => api.get(`/disputes/${id}/messages`),
 
 uploadEvidence: (
 id: string,
 data: { type: EvidenceType; description: string; fileUrl?: string },
 ) => api.post(`/disputes/${id}/evidence`, data),
};

// Rating API
export const ratingApi = {
 create: (data: { orderId: string; rating: number; comment?: string }) =>
 api.post('/ratings', data),
 
 getForOrder: (orderId: string) => api.get(`/ratings/order/${orderId}`),
 
 getForUser: (userId: string, params?: { page?: number; limit?: number }) =>
 api.get(`/ratings/user/${userId}`, { params }),
};

// Referral API
export const referralApi = {
 getCode: () => api.get('/referral/code'),
 
 getStats: () => api.get('/referral/stats'),
 
 getReferrals: (params?: { page?: number; limit?: number }) =>
 api.get('/referral/list', { params }),
 
 getRewards: (params?: { status?: string; page?: number; limit?: number }) =>
 api.get('/referral/rewards', { params }),
 
 claimReward: (rewardId: string) => api.post(`/referral/rewards/${rewardId}/claim`),
 
 applyCode: (code: string) => api.post('/referral/apply', { code }),
 
 validateCode: (code: string) => api.get(`/referral/validate/${code}`),
};

// Activity API
export const activityApi = {
 list: (params?: { type?: string; page?: number; limit?: number; from?: string; to?: string }) =>
 api.get('/activity', { params }),
 
 getSummary: () => api.get('/activity/summary'),
 
 getStats: () => api.get('/activity/stats'),
 
 getSessions: () => api.get('/activity/sessions'),
 
 getSecurity: (params?: { page?: number; limit?: number }) =>
 api.get('/activity/security', { params }),
 
 getWallet: (params?: { page?: number; limit?: number; type?: string }) =>
 api.get('/activity/wallet', { params }),
 
 getTransactions: (params?: { page?: number; limit?: number; status?: string }) =>
 api.get('/activity/transactions', { params }),
};

// Promo/Voucher API
export const promoApi = {
 validate: (code: string, orderAmount: number) =>
 api.post('/promo/validate', { code, orderAmount }),
 
 apply: (code: string, orderId: string) =>
 api.post('/promo/apply', { code, orderId }),
 
 getAvailable: () => api.get('/promo/available'),
};

// Admin API
export const adminApi = {
 // Dashboard
 getDashboard: () => api.get('/admin/dashboard'),
 
 // Users
 getUsers: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
 api.get('/admin/users', { params }),
 
 getUser: (id: string) => api.get(`/admin/users/${id}`),
 
 updateUser: (id: string, data: AdminUserUpdate) => api.patch(`/admin/users/${id}`, data),
 
 suspendUser: (id: string, reason: string, until?: string) =>
 api.post(`/admin/users/${id}/suspend`, { reason, until }),
 
 unsuspendUser: (id: string) => api.post(`/admin/users/${id}/unsuspend`),
 
 activateUser: (id: string) => api.post(`/admin/users/${id}/activate`),
 
 approveKYC: (userId: string) => api.post(`/admin/users/${userId}/kyc/approve`),
 
 rejectKYC: (userId: string, reason: string) => api.post(`/admin/users/${userId}/kyc/reject`, { reason }),
 
 // Transactions
 getTransactions: (params?: { page?: number; limit?: number; status?: string }) =>
 api.get('/admin/transactions', { params }),
 
 getTransaction: (id: string) => api.get(`/admin/transactions/${id}`),
 
 // Disputes
 getDisputes: (params?: { page?: number; limit?: number; status?: string }) =>
 api.get('/admin/disputes', { params }),
 
 getDispute: (id: string) => api.get(`/admin/disputes/${id}`),
 
 resolveDispute: (
 id: string,
 data: {
 decision: string;
 resolutionNotes: string;
 buyerRefundMinor?: string;
 sellerAmountMinor?: string;
 },
 ) =>
 api.post(`/admin/disputes/${id}/resolve`, data),
 
 // KYC
 getKYCRequests: (params?: { page?: number; limit?: number; status?: string }) =>
 api.get('/admin/kyc', { params }),
 
 getKYCRequest: (id: string) => api.get(`/admin/kyc/${id}`),
 
 // Withdrawals
 getWithdrawals: (params?: { page?: number; limit?: number; status?: string }) =>
 api.get('/admin/withdrawals', { params }),
 
 approveWithdrawal: (id: string) => api.post(`/admin/withdrawals/${id}/approve`),
 
 rejectWithdrawal: (id: string, reason: string) =>
 api.post(`/admin/withdrawals/${id}/reject`, { reason }),
 
 // Settings
 getSettings: () => api.get('/admin/settings'),
 
 updateSettings: (data: PlatformSettingsUpdate) => api.patch('/admin/settings', data),
 
 // Analytics
 getAnalytics: (params?: { startDate?: string; endDate?: string }) =>
 api.get('/admin/analytics', { params }),
 
 // Promos
 getPromos: (params?: { page?: number; limit?: number }) =>
 api.get('/admin/promos', { params }),
 
 createPromo: (data: CreatePromoData) => api.post('/admin/promos', data),
 
 updatePromo: (id: string, data: UpdatePromoData) => api.patch(`/admin/promos/${id}`, data),
 
 deletePromo: (id: string) => api.delete(`/admin/promos/${id}`),
 
 // Audit Logs
 getAuditLogs: (params?: { page?: number; limit?: number; action?: string; userId?: string }) =>
 api.get('/admin/audit-logs', { params }),
 
 // Dashboard Stats
 getDashboardStats: () => api.get('/admin/dashboard'),
 
 // Deposits
 getDeposits: (params?: { page?: number; limit?: number; status?: string }) =>
 api.get('/admin/deposits', { params }),
 
 getDeposit: (id: string) => api.get(`/admin/deposits/${id}`),
 
 // Analytics
 getAnalyticsOverview: () => api.get('/admin/analytics/overview'),
 
 getAnalyticsCharts: (period?: string) =>
 api.get('/admin/analytics/charts', { params: { period } }),
 
 // Reports
 getRevenueReport: (params?: { startDate?: string; endDate?: string }) =>
 api.get('/admin/reports/revenue', { params }),
 
 getTransactionReport: (params?: { startDate?: string; endDate?: string }) =>
 api.get('/admin/reports/transactions', { params }),
 
 getUserReport: (params?: { startDate?: string; endDate?: string }) =>
 api.get('/admin/reports/users', { params }),
 
 // Dispute Management
 startReview: (id: string) => api.post(`/admin/disputes/${id}/review`),
 
 assignArbitrator: (disputeId: string, arbitratorId: string) =>
 api.post(`/admin/disputes/${disputeId}/assign`, { arbitratorId }),
 
 // Promo Management
 deactivatePromo: (id: string) => api.post(`/admin/promos/${id}/deactivate`),
 
 // Transaction Management
 forceCompleteTransaction: (id: string, reason: string) =>
 api.post(`/admin/transactions/${id}/force-complete`, { reason }),
 
 forceCancelTransaction: (id: string, reason: string) =>
 api.post(`/admin/transactions/${id}/force-cancel`, { reason }),
 
 // Withdrawal Management
 getPendingWithdrawals: (params?: { page?: number; limit?: number }) =>
 api.get('/admin/withdrawals/pending', { params }),
};

// Alias for backward compatibility
export const bankApi = bankAccountApi;

export default api;
