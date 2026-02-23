/*
 * KAHADE API SERVICE - SECURITY ENHANCED
 *
 * FIXES APPLIED:
 * [Issue #7]  CSRF header name standardized: x-xsrf-token (send) matches what
 *             backend sets as x-xsrf-token response header. Both sides must agree.
 *             Update backend if it currently sends x-csrf-token.
 * [Issue #8]  Idempotency key uses crypto.randomUUID() — cryptographically secure.
 * [Issue #13] Removed duplicate withdrawWithBankAccount — use withdraw() directly.
 * [Issue #14] Removed duplicate getDashboardStats — use getDashboard() directly.
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

const API_BASE_URL = APP_URLS.api;
const REQUEST_TIMEOUT = 15000;
const USER_CACHE_KEY = 'kahade_user_cache';

// FIX (Issue #7): Standardize CSRF header name.
// Choose ONE name and use it consistently here AND in the backend.
// We use 'x-xsrf-token' (XSRF is the canonical OWASP name for this pattern).
const CSRF_REQUEST_HEADER = 'x-xsrf-token';
const CSRF_RESPONSE_HEADER = 'x-xsrf-token'; // backend must send this

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,
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

// FIX (Issue #8): Use crypto.randomUUID() — cryptographically secure, no Math.random()
function generateRequestId(): string {
  return crypto.randomUUID();
}

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const isStateChanging = ['post', 'put', 'patch', 'delete'].includes(
      config.method?.toLowerCase() || ''
    );

    if (isStateChanging && !SecureStorage.getCsrfToken()) {
      await ensureCsrfSeeded();
    }

    const csrfToken = SecureStorage.getCsrfToken();
    if (csrfToken) {
      // FIX (Issue #7): Use the standardized header name
      config.headers[CSRF_REQUEST_HEADER] = csrfToken;
    }

    config.headers['X-Request-ID'] = generateRequestId();

    // Idempotency key for financial endpoints
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
      const isFinancialEndpoint =
        config.url?.includes('/wallet/') ||
        config.url?.includes('/transactions/') ||
        config.url?.includes('/withdraw') ||
        config.url?.includes('/topup');

      if (isFinancialEndpoint && !config.headers['X-Idempotency-Key']) {
        // FIX (Issue #8): crypto.randomUUID() instead of Math.random()
        config.headers['X-Idempotency-Key'] = generateRequestId();
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // FIX (Issue #7): Read CSRF token using standardized header name
    const csrfToken = response.headers[CSRF_RESPONSE_HEADER];
    if (csrfToken) {
      SecureStorage.setCsrfToken(csrfToken);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          await authApi.refreshToken();
          return api(originalRequest);
        } catch (refreshError) {
          clearAuth();
          redirectToLogin();
        }
      } else {
        clearAuth();
        redirectToLogin();
      }
    }

    if (error.response?.status === 403) {
      apiLogger.warn('Access forbidden', error.response.data);
    }

    if (error.response?.status === 429) {
      apiLogger.warn('Rate limit exceeded. Please wait before trying again.');
    }

    if (error.response?.status && error.response.status >= 500) {
      apiLogger.error('Server error', error.response.data as Error);
    }

    return Promise.reject(error);
  }
);

function clearAuth(): void {
  sessionStorage.removeItem(USER_CACHE_KEY);
  SecureStorage.clearAll();
}

function redirectToLogin(): void {
  if (
    window.location.pathname.includes('/login') ||
    window.location.pathname.includes('/register')
  ) {
    return;
  }

  const hostname = window.location.hostname;
  const isLandingDomain = !hostname.startsWith('app.') && !hostname.startsWith('admin.');

  if (isLandingDomain) {
    return;
  }

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

  // FIX (Issue #26): Token in path param, not querystring — avoids server logs exposure
  validateResetToken: (token: string) =>
    api.get(`/auth/reset-password/validate/${encodeURIComponent(token)}`),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),

  verifyEmail: (token: string) =>
    api.post('/auth/verify-email', { token }),

  resendVerification: () =>
    api.post('/auth/resend-verification'),

  me: () => api.get('/auth/me'),

  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  refreshToken: () => api.post('/auth/refresh'),

  // 2FA
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
  submitRating: (id: string, data: { score: number; comment?: string }) =>
    api.post(`/transactions/${id}/rating`, data),
  getRatings: (id: string) => api.get(`/transactions/${id}/ratings`),
  validateCounterparty: (email: string) =>
    api.get('/users/validate-email', { params: { email } }),
};

// Wallet API
export const walletApi = {
  getBalance: () => api.get('/wallet/balance'),
  getDetailedBalance: () => api.get('/wallet/balance/detailed'),

  getTransactions: (params?: { type?: string; page?: number; limit?: number }) =>
    api.get('/wallet/transactions', { params }),

  topUp: (data: { amount: number; method: string }) =>
    api.post('/wallet/topup', data),

  // FIX (Issue #8): idempotencyKey uses crypto.randomUUID() via generateRequestId()
  // FIX (Issue #13): Removed duplicate withdrawWithBankAccount — this method handles both
  withdraw: (
    data: { amountMinor: number; bankAccountId: string },
    options?: { mfaToken?: string; idempotencyKey?: string },
  ) =>
    api.post('/wallet/withdraw', data, {
      headers: {
        ...(options?.mfaToken ? { 'x-mfa-token': options.mfaToken } : {}),
        'x-idempotency-key': options?.idempotencyKey ?? generateRequestId(),
      },
    }),

  cancelWithdrawal: (withdrawalId: string) =>
    api.post(`/wallet/withdrawals/${withdrawalId}/cancel`),

  getBanks: () => api.get('/wallet/banks'),

  getWithdrawals: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/wallet/withdrawals', { params }),

  getDeposits: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/wallet/deposits', { params }),

  getDeposit: (depositId: string) =>
    api.get(`/wallet/deposits/${depositId}`),

  getWithdrawal: (withdrawalId: string) =>
    api.get(`/wallet/withdrawals/${withdrawalId}`),
};

// Bank Account API
export const bankAccountApi = {
  list: () => api.get('/bank/accounts'),
  get: (id: string) => api.get(`/bank/accounts/${id}`),
  create: (data: { bankCode: string; accountNumber: string; accountHolderName: string }) =>
    api.post('/bank/accounts', data),
  delete: (id: string) => api.delete(`/bank/accounts/${id}`),
  setDefault: (id: string) => api.patch(`/bank/accounts/${id}/default`),
  verify: (id: string) => api.post(`/bank/accounts/${id}/verify`),
  getSupportedBanks: () => api.get('/bank/list'),
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
  // FIX (Issue #14): getDashboardStats removed — was identical to getDashboard
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
  forceCompleteTransaction: (id: string, reason: string) =>
    api.post(`/admin/transactions/${id}/force-complete`, { reason }),
  forceCancelTransaction: (id: string, reason: string) =>
    api.post(`/admin/transactions/${id}/force-cancel`, { reason }),

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
  ) => api.post(`/admin/disputes/${id}/resolve`, data),
  startReview: (id: string) => api.post(`/admin/disputes/${id}/review`),
  assignArbitrator: (disputeId: string, arbitratorId: string) =>
    api.post(`/admin/disputes/${disputeId}/assign`, { arbitratorId }),

  // KYC
  getKYCRequests: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/kyc', { params }),
  getKYCRequest: (id: string) => api.get(`/admin/kyc/${id}`),

  // Withdrawals
  getWithdrawals: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/withdrawals', { params }),
  getPendingWithdrawals: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/withdrawals/pending', { params }),
  approveWithdrawal: (id: string) => api.post(`/admin/withdrawals/${id}/approve`),
  rejectWithdrawal: (id: string, reason: string) =>
    api.post(`/admin/withdrawals/${id}/reject`, { reason }),

  // Deposits
  getDeposits: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/admin/deposits', { params }),
  getDeposit: (id: string) => api.get(`/admin/deposits/${id}`),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: PlatformSettingsUpdate) => api.patch('/admin/settings', data),

  // Analytics
  getAnalytics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/admin/analytics', { params }),
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

  // Promos
  getPromos: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/promos', { params }),
  createPromo: (data: CreatePromoData) => api.post('/admin/promos', data),
  updatePromo: (id: string, data: UpdatePromoData) => api.patch(`/admin/promos/${id}`, data),
  deletePromo: (id: string) => api.delete(`/admin/promos/${id}`),
  deactivatePromo: (id: string) => api.post(`/admin/promos/${id}/deactivate`),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; userId?: string }) =>
    api.get('/admin/audit-logs', { params }),
};

// Backward compat alias
export const bankApi = bankAccountApi;

export default api;
