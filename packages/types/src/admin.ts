/*
 * KAHADE ADMIN TYPE DEFINITIONS
 * Type-safe interfaces for admin operations
 */

// FIX: Import from './core' directly, NOT from './index'.
// Importing from './index' creates a circular dependency:
// index.ts → admin.ts → index.ts → (loop)
import { User, KYCStatus, TransactionStatus, DisputeStatus, PromoType } from "./core";

// ============================================================================
// USER MANAGEMENT TYPES
// ============================================================================

export interface AdminUserUpdate {
  username?: string;
  email?: string;
  phone?: string;
  role?: "USER" | "ADMIN";
  status?: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  kycStatus?: KYCStatus;
}

export interface UserSuspension {
  reason: string;
  until?: string; // ISO date string
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface PlatformSettingsUpdate {
  platformFee?: number;
  minTransaction?: number;
  maxTransaction?: number;
  escrowDuration?: number;
  disputeWindow?: number;
  autoReleaseDays?: number;
  maintenanceMode?: boolean;
  registrationEnabled?: boolean;
  kycRequired?: boolean;
  emailNotifications?: boolean;
  slackNotifications?: boolean;
}

// ============================================================================
// PROMO TYPES
// ============================================================================

export interface CreatePromoData {
  code: string;
  type: PromoType;
  value: number;
  minTransaction?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  description?: string;
}

export interface UpdatePromoData {
  code?: string;
  type?: PromoType;
  value?: number;
  minTransaction?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  description?: string;
}

// ============================================================================
// DISPUTE RESOLUTION TYPES
// ============================================================================

export interface DisputeResolution {
  resolution: string;
  winner: "buyer" | "seller" | "split";
  refundBuyer: boolean;
  refundAmount?: number;
  notes?: string;
}

// ============================================================================
// KYC TYPES
// ============================================================================

export interface KYCApproval {
  notes?: string;
}

export interface KYCRejection {
  reason: string;
  notes?: string;
}

// ============================================================================
// WITHDRAWAL TYPES
// ============================================================================

export interface WithdrawalApproval {
  notes?: string;
  transactionId?: string;
}

export interface WithdrawalRejection {
  reason: string;
  notes?: string;
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface ReportParams {
  startDate?: string;
  endDate?: string;
  groupBy?: "day" | "week" | "month";
}

export interface RevenueReport {
  period: string;
  totalRevenue: number;
  platformFees: number;
  transactionCount: number;
  averageTransactionValue: number;
}

export interface TransactionReport {
  period: string;
  total: number;
  completed: number;
  cancelled: number;
  disputed: number;
  volume: number;
}

export interface UserReport {
  period: string;
  newUsers: number;
  activeUsers: number;
  kycVerified: number;
  suspended: number;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  totalVolume: number;
  totalRevenue: number;
  pendingWithdrawals: number;
  openDisputes: number;
  pendingKYC: number;
}

export interface AnalyticsChart {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// NAV ITEM TYPES
// ============================================================================

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: NavItem[];
}

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface TableColumn<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

export interface TableAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: T) => void;
  variant?: "default" | "destructive" | "outline";
  disabled?: (row: T) => boolean;
}
