/*
 * KAHADE TYPE DEFINITIONS
 * Enhanced with strict typing and comprehensive interfaces
 */

// ============================================================================
// ERROR CODES (matching backend)
// ============================================================================

export enum ErrorCode {
 // Authentication errors
 UNAUTHORIZED = "AUTH_001",
 INVALID_CREDENTIALS = "AUTH_002",
 TOKEN_EXPIRED = "AUTH_003",
 MFA_REQUIRED = "AUTH_004",
 ACCOUNT_LOCKED = "AUTH_005",
 SESSION_EXPIRED = "AUTH_006",

 // Validation errors
 VALIDATION_ERROR = "VAL_001",
 INVALID_INPUT = "VAL_002",
 MISSING_REQUIRED_FIELD = "VAL_003",
 INVALID_FORMAT = "VAL_004",

 // Resource errors
 NOT_FOUND = "RES_001",
 ALREADY_EXISTS = "RES_002",
 CONFLICT = "RES_003",

 // Business logic errors
 INSUFFICIENT_BALANCE = "BIZ_001",
 TRANSACTION_LIMIT_EXCEEDED = "BIZ_002",
 KYC_REQUIRED = "BIZ_003",
 OPERATION_NOT_ALLOWED = "BIZ_004",
 CONCURRENT_MODIFICATION = "BIZ_005",
 WALLET_FROZEN = "BIZ_006",

 // System errors
 INTERNAL_ERROR = "SYS_001",
 RATE_LIMIT_EXCEEDED = "SYS_003",
 SERVICE_UNAVAILABLE = "SYS_004",
}

// ============================================================================
// USER TYPES
// ============================================================================

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type KYCStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

export interface User {
 id: string;
 email: string;
 username: string;
 phone?: string;
 role: UserRole;
 kycStatus: KYCStatus;
 status: UserStatus;
 reputationScore: number;
 totalTransactions: number;
 avatarUrl?: string;
 mfaEnabled?: boolean;
 emailVerifiedAt?: string;
 createdAt: string;
 updatedAt: string;
}

export interface UserProfile extends User {
 notificationSettings?: NotificationSettings;
 referralCode?: string;
 badges?: Badge[];
}

export interface Badge {
 id: string;
 name: string;
 description: string;
 icon: string;
 earnedAt: string;
}

export interface NotificationSettings {
 email: boolean;
 push: boolean;
 transaction: boolean;
 marketing: boolean;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

// Backend OrderStatus enum: WAITING_COUNTERPARTY, PENDING_ACCEPT, ACCEPTED, PAID, COMPLETED, CANCELLED, DISPUTED, REFUNDED
// DELIVERED is a virtual status determined by PAID + deliveryProof existence
export type TransactionStatus =
 | "WAITING_COUNTERPARTY"
 | "PENDING_ACCEPT"
 | "ACCEPTED"
 | "PAID"
 | "DELIVERED" // Virtual status: PAID + has deliveryProof
 | "COMPLETED"
 | "DISPUTED"
 | "CANCELLED"
 | "REFUNDED";

export type TransactionCategory =
 | "ELECTRONICS"
 | "FASHION"
 | "SERVICES"
 | "DIGITAL"
 | "AUTOMOTIVE"
 | "PROPERTY"
 | "OTHER";

export type TransactionRole = "buyer" | "seller";
export type FeePaidBy = "buyer" | "seller" | "split";

export interface Transaction {
 id: string;
 orderNumber: string;
 title: string;
 description: string;
 amount: number;
 platformFee: number;
 totalAmount: number;
 status: TransactionStatus;
 category: TransactionCategory;
 buyerId: string;
 buyer: User;
 sellerId: string;
 seller: User;
 initiatorRole: TransactionRole;
 feePaidBy: FeePaidBy;
 terms?: string;
 createdAt: string;
 acceptedAt?: string;
 paidAt?: string;
 completedAt?: string;
 cancelledAt?: string;
 counterparty?: User;
 deliveryProof?: {
 id: string;
 courier?: string;
 trackingNumber?: string;
 fileUrls?: string[];
 notes?: string;
 submittedAt: string;
 };
}

export interface TransactionTimeline {
 id: string;
 status: TransactionStatus;
 timestamp: string;
 description: string;
 actor?: string;
 actorRole?: TransactionRole;
}

export interface TransactionMessage {
 id: string;
 transactionId: string;
 senderId: string;
 sender: User;
 message: string;
 attachments?: string[];
 createdAt: string;
}

export interface CreateTransactionData {
 counterpartyEmail?: string;
 counterpartyId?: string;
 role: TransactionRole;
 title: string;
 description: string;
 category: TransactionCategory;
 amount: number;
 feePaidBy: FeePaidBy;
 terms?: string;
}

// ============================================================================
// WALLET TYPES
// ============================================================================

export interface WalletBalance {
 available: number;
 locked: number;
 frozen: number;
 total: number;
 currency: string;
 isFrozen: boolean;
 frozenReason?: string;
}

export type WalletTransactionType = "deposit" | "withdrawal" | "transfer" | "escrow" | "release" | "refund";
export type WalletTransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED" | "PROCESSING";

export interface WalletTransaction {
 id: string;
 type: WalletTransactionType;
 amount: number;
 description: string;
 status: WalletTransactionStatus;
 referenceId?: string;
 createdAt: string;
}

export interface Bank {
 code: string;
 name: string;
 logo?: string;
}

export interface BankAccount {
 id: string;
 bankCode: string;
 bankName: string;
 accountNumberLast4: string;
 accountHolderName: string;
 isVerified: boolean;
 isPrimary: boolean;
 createdAt: string;
}

export interface TopUpRequest {
 amount: number;
 method: string;
}

export interface TopUpResponse {
 id: string;
 amount: number;
 method: string;
 paymentUrl?: string;
 vaNumber?: string;
 expiresAt: string;
}

export interface WithdrawRequest {
 amount: number;
 bankAccountId: string;
 pin?: string;
}

export interface WithdrawResponse {
 id: string;
 amount: number;
 fee: number;
 netAmount: number;
 bankAccount: {
 bankName: string;
 accountNumberLast4: string;
 accountHolderName: string;
 };
 estimatedArrival: string;
}

// ============================================================================
// DISPUTE TYPES
// ============================================================================

export type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
export type DisputePriority = "LOW" | "MEDIUM" | "HIGH";
export type DisputeWinner = "buyer" | "seller" | "split";
export type DisputeReason =
 | "PRODUCT_NOT_AS_DESCRIBED"
 | "PRODUCT_NOT_RECEIVED"
 | "PRODUCT_DAMAGED"
 | "SELLER_NOT_RESPONDING"
 | "PAYMENT_ISSUE"
 | "FRAUD_SUSPECTED"
 | "OTHER";
export type EvidenceType =
 | "SCREENSHOT"
 | "PHOTO"
 | "VIDEO"
 | "DOCUMENT"
 | "CHAT_LOG"
 | "RECEIPT"
 | "TRACKING_INFO"
 | "OTHER";

export interface Dispute {
 id: string;
 transactionId: string;
 transaction: Transaction;
 reason: string;
 description: string;
 status: DisputeStatus;
 priority: DisputePriority;
 evidence: string[];
 resolution?: string;
 winner?: DisputeWinner;
 resolvedBy?: string;
 createdAt: string;
 resolvedAt?: string;
}

export interface DisputeEvidence {
 id: string;
 disputeId: string;
 uploadedBy: string;
 fileUrl: string;
 fileType: string;
 description?: string;
 createdAt: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType = "TRANSACTION" | "PAYMENT" | "INFO" | "ALERT" | "SYSTEM";

export interface Notification {
 id: string;
 type: NotificationType;
 title: string;
 message: string;
 read: boolean;
 data?: NotificationData;
 createdAt: string;
}

export interface NotificationData {
 transactionId?: string;
 disputeId?: string;
 actionUrl?: string;
 [key: string]: unknown;
}

// ============================================================================
// RATING TYPES
// ============================================================================

export interface Rating {
 id: string;
 transactionId: string;
 raterId: string;
 rater: User;
 ratedId: string;
 rated: User;
 score: number;
 comment?: string;
 createdAt: string;
}

export interface RatingStats {
 averageScore: number;
 totalRatings: number;
 distribution: Record<number, number>;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export type AuditAction =
 | "USER_LOGIN"
 | "USER_LOGOUT"
 | "USER_REGISTERED"
 | "USER_SUSPENDED"
 | "USER_ACTIVATED"
 | "TRANSACTION_CREATED"
 | "TRANSACTION_ACCEPTED"
 | "TRANSACTION_PAID"
 | "TRANSACTION_COMPLETED"
 | "TRANSACTION_CANCELLED"
 | "KYC_SUBMITTED"
 | "KYC_APPROVED"
 | "KYC_REJECTED"
 | "WITHDRAWAL_REQUESTED"
 | "WITHDRAWAL_PROCESSED"
 | "DISPUTE_CREATED"
 | "DISPUTE_RESOLVED"
 | "PAYMENT_RECEIVED"
 | "SETTINGS_UPDATED"
 | "MFA_ENABLED"
 | "MFA_DISABLED"
 | "PASSWORD_CHANGED";

export type ActorType = "USER" | "ADMIN" | "SYSTEM";

export interface AuditLog {
 id: string;
 action: AuditAction;
 actor: string;
 actorType: ActorType;
 target: string;
 details: AuditLogDetails;
 ipAddress?: string;
 userAgent?: string;
 timestamp: string;
}

export interface AuditLogDetails {
 [key: string]: unknown;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
 statusCode: number;
 success: boolean;
 message: string;
 data: T;
 requestId?: string;
 timestamp: string;
}

export interface ApiErrorResponse {
 statusCode: number;
 success: false;
 code: ErrorCode | string;
 message: string;
 errors?: ValidationError[];
 path: string;
 method: string;
 requestId?: string;
 timestamp: string;
}

export interface ValidationError {
 field: string;
 message: string;
 constraint?: string;
}

export interface PaginationMeta {
 page: number;
 limit: number;
 total: number;
 totalPages: number;
 hasNext: boolean;
 hasPrev: boolean;
}

export interface PaginatedResponse<T> {
 statusCode: number;
 success: boolean;
 message: string;
 data: T[];
 pagination: PaginationMeta;
 requestId?: string;
 timestamp: string;
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface DashboardStats {
 totalUsers: number;
 activeTransactions: number;
 totalVolume: number;
 activeDisputes: number;
 userGrowth: number;
 transactionGrowth: number;
 volumeGrowth: number;
 disputeChange: number;
}

export interface AdminAnalytics {
 period: string;
 transactions: number;
 volume: number;
 users: number;
 disputes: number;
}

export interface PlatformSettings {
 platformFee: number;
 minTransaction: number;
 maxTransaction: number;
 escrowDuration: number;
 disputeWindow: number;
 autoReleaseDays: number;
 maintenanceMode: boolean;
 registrationEnabled: boolean;
 kycRequired: boolean;
 emailNotifications: boolean;
 slackNotifications: boolean;
}

// ============================================================================
// KYC TYPES
// ============================================================================

export interface KYCSubmission {
 id: string;
 userId: string;
 status: KYCStatus;
 fullName?: string;
 idNumber?: string;
 dateOfBirth?: string;
 address?: string;
 idCardUrl?: string;
 selfieUrl?: string;
 rejectionReason?: string;
 submittedAt: string;
 verifiedAt?: string;
}

// ============================================================================
// PROMO TYPES
// ============================================================================

export type PromoType = "PERCENTAGE" | "FIXED" | "FREE_FEE";

export interface Promo {
 id: string;
 code: string;
 type: PromoType;
 value: number;
 minTransaction?: number;
 maxDiscount?: number;
 usageLimit?: number;
 usageCount: number;
 startDate: string;
 endDate: string;
 isActive: boolean;
 createdAt: string;
}

// ============================================================================
// REFERRAL TYPES
// ============================================================================

export interface ReferralCode {
 code: string;
 usageCount: number;
 maxUsages?: number;
 isActive: boolean;
 expiresAt?: string;
}

export interface ReferralUsage {
 id: string;
 referredUser: User;
 status: "PENDING" | "COMPLETED" | "EXPIRED";
 reward?: number;
 usedAt: string;
 completedAt?: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface LoginFormData {
 email: string;
 password: string;
 mfaCode?: string;
}

export interface RegisterFormData {
 email: string;
 username: string;
 password: string;
 confirmPassword: string;
 phone?: string;
 referralCode?: string;
 acceptTerms: boolean;
}

export interface ResetPasswordFormData {
 token: string;
 password: string;
 confirmPassword: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type LoadingState = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
 data: T | null;
 loading: boolean;
 error: string | null;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
 field: string;
 direction: SortDirection;
}

export interface FilterConfig {
 [key: string]: string | number | boolean | undefined;
}
