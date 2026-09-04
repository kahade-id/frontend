/**
 * Kahade — tipe REQUEST DTO, DIHASILKAN OTOMATIS dari
 * docs/api/kahade-api-mobile.json oleh scripts/gen-api-types.mjs.
 *
 * JANGAN EDIT MANUAL. Ubah spec → `npm run gen:api`.
 *
 * Spec: Kahade API v1.0 · 87 DTO dipakai
 * (28 schema admin-only dilewati).
 */

export type RegisterDto = {
  /**
   * Full name
   * minLength 2 · maxLength 60
   */
  fullName: string
  /**
   * Unique username (3-30 characters)
   * minLength 3 · maxLength 30
   */
  username?: string
  /**
   * Email address
   * maxLength 254
   */
  email: string
  /**
   * Password (min 12 chars, must contain uppercase, lowercase, digit, and special character)
   * minLength 12 · maxLength 72
   */
  password: string
  /**
   * Confirm password
   * minLength 12 · maxLength 72
   */
  confirmPassword: string
  /**
   * Phone number (E.164 or local Indonesian format, e.g. 08xx)
   * maxLength 20
   */
  phoneNumber?: string
  /**
   * Date of birth (ISO 8601: YYYY-MM-DD)
   * contoh "1995-06-15"
   */
  dateOfBirth?: string
  /** Gender */
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
  /**
   * Referral code (optional)
   * maxLength 20
   */
  referralCode?: string
  /** Captcha challenge ID */
  captchaId?: string
  /** Captcha answer (X position 0-100) */
  captchaAnswer?: number
}

export type RequestOtpDto = {
  /**
   * Indonesian phone number (e.g. 08xx or +628xx)
   * maxLength 20
   */
  phoneNumber: string
  /** OTP delivery method */
  method: "SMS" | "WHATSAPP"
}

export type VerifyPhoneOtpDto = {
  /**
   * Indonesian phone number
   * maxLength 20
   */
  phoneNumber: string
  /** 6-digit OTP code */
  code: string
  /**
   * Device identifier
   * maxLength 255
   */
  deviceId: string
  /**
   * Device information
   * maxLength 512
   */
  deviceInfo?: string
}

export type PhoneRegisterDto = {
  /** Temp token from OTP verification */
  tempToken: string
  /**
   * Full name
   * minLength 2 · maxLength 60
   */
  fullName: string
  /**
   * Unique username (3-30 characters)
   * minLength 3 · maxLength 30
   */
  username: string
  /**
   * Date of birth (ISO 8601: YYYY-MM-DD)
   * contoh "1995-06-15"
   */
  dateOfBirth: string
  /** Gender */
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
  /**
   * Email address
   * maxLength 254
   */
  email: string
  /**
   * Password (min 12 chars, must contain uppercase, lowercase, digit, and special character)
   * minLength 12 · maxLength 72
   */
  password: string
  /**
   * Wallet PIN (6 digits)
   * minLength 6 · maxLength 6
   */
  pin: string
  /**
   * Full address
   * maxLength 500
   */
  address?: string
  /**
   * Referral code (optional)
   * maxLength 20
   */
  referralCode?: string
  /**
   * Device identifier for session tracking
   * maxLength 255
   */
  deviceId?: string
}

export type SetUsernameDto = {
  /**
   * Unique username (3-20 characters)
   * minLength 3 · maxLength 20
   */
  username: string
}

export type VerifyEmailDto = {
  /**
   * Email address to verify
   * maxLength 254
   */
  email: string
  /**
   * OTP code (6 digits)
   * minLength 6 · maxLength 6
   */
  otp: string
}

export type ResendVerificationDto = {
  /**
   * Email address
   * maxLength 254
   */
  email: string
}

export type CorrectEmailDto = {
  /**
   * New email address
   * maxLength 254
   */
  newEmail: string
  /**
   * Current password for verification
   * maxLength 72
   */
  password: string
}

export type LoginDto = {
  /**
   * User email address
   * maxLength 254
   */
  email: string
  /**
   * User password
   * maxLength 72
   */
  password: string
  /**
   * Device identifier
   * maxLength 255
   */
  deviceId: string
  /**
   * Device information (User-Agent)
   * maxLength 512
   */
  deviceInfo?: string
  /** Captcha challenge ID */
  captchaId?: string
  /** Captcha answer (X position 0-100) */
  captchaAnswer?: number
}

export type Verify2faLoginDto = {
  /**
   * Temporary token from login
   * maxLength 512
   */
  tempToken: string
  /**
   * Six-digit TOTP code or 10–16 character backup code
   * minLength 6 · maxLength 16
   */
  code: string
  /**
   * Device identifier
   * maxLength 255
   */
  deviceId: string
  /**
   * Device information
   * maxLength 512
   */
  deviceInfo?: string
}

export type RefreshTokenDto = Record<string, never>

export type LogoutDto = {
  /**
   * Logout from all devices
   * default false
   */
  logoutAll?: boolean
}

export type ForgotPasswordDto = {
  /**
   * Email address
   * maxLength 254
   */
  email: string
  /** Captcha challenge ID */
  captchaId?: string
  /** Captcha answer (X position 0-100) */
  captchaAnswer?: number
}

export type ResetPasswordDto = {
  /**
   * Email address
   * maxLength 254
   */
  email: string
  /**
   * OTP code (6 digits)
   * minLength 6 · maxLength 6
   */
  otp: string
  /**
   * New password
   * minLength 12 · maxLength 72
   */
  newPassword: string
  /**
   * Confirm new password
   * minLength 12 · maxLength 72
   */
  confirmPassword: string
}

export type VerifyPasswordDto = {
  /** Password to verify */
  password: string
}

export type ChangePasswordDto = {
  /**
   * Current password
   * maxLength 72
   */
  currentPassword: string
  /**
   * New password
   * minLength 12 · maxLength 72
   */
  newPassword: string
  /**
   * Confirm new password
   * minLength 12 · maxLength 72
   */
  confirmPassword: string
}

export type Setup2faDto = {
  /**
   * Current password for verification
   * maxLength 72
   */
  password: string
}

export type Enable2faDto = {
  /**
   * TOTP code from authenticator app
   * minLength 6 · maxLength 6
   */
  code: string
}

export type Disable2faDto = {
  /**
   * Current account password
   * maxLength 72
   */
  password: string
  /**
   * Six-digit authenticator TOTP code
   * minLength 6 · maxLength 6
   */
  code: string
  /**
   * Email OTP code for verification
   * minLength 6 · maxLength 6
   */
  emailOtpCode: string
}

export type UpdateProfileDto = {
  /**
   * Full name
   * minLength 2 · maxLength 60
   */
  fullName?: string
  /**
   * Username (can be changed once per month)
   * minLength 3 · maxLength 30
   */
  username?: string
  /**
   * User bio
   * minLength 0 · maxLength 500
   */
  bio?: string
  /** Account type */
  accountType?: "PERSONAL" | "BUSINESS"
  /** Phone number */
  phoneNumber?: string
  /** Date of birth (ISO date string) */
  dateOfBirth?: string
  /** Gender */
  gender?: string
  /** Contact email (public) */
  contactEmail?: string
  /** Contact phone (public) */
  contactPhone?: string
  /** Show contact email on profile */
  showContactEmail?: boolean
  /** Show contact phone on profile */
  showContactPhone?: boolean
  /** Profile visibility */
  profileVisible?: boolean
  /** Show online status */
  showOnlineStatus?: boolean
  /** Current password (required when changing username, phone, or contact info) */
  currentPassword?: string
}

export type UploadAvatarDto = {
  /**
   * Content type of the image
   * contoh "image/jpeg"
   */
  contentType?: string
}

export type ConfirmAvatarDto = {
  /** S3 key of the uploaded avatar */
  avatarKey: string
}

export type ConfirmHeaderDto = {
  /** S3 key of the uploaded header image */
  headerKey: string
}

export type UserLinkItemDto = {
  /**
   * Platform name (e.g. instagram, twitter, website)
   * maxLength 30
   */
  platform: string
  /**
   * Link URL
   * maxLength 500
   */
  url: string
  /**
   * Display label
   * maxLength 50
   */
  label?: string
  /** Display order */
  displayOrder?: number
}

export type UpdateLinksDto = {
  /** Array of links (replaces all existing) */
  links: Array<UserLinkItemDto>
}

export type RequestAccountDeletionDto = {
  /** Current password for verification */
  password: string
  /**
   * Reason for account deletion
   * maxLength 1000
   */
  reason?: string
  /** TOTP code for users with 2FA enabled */
  mfaCode?: string
}

export type TrustDeviceDto = Record<string, never>

export type CreateShowcaseDto = {
  title: string
  description?: string
  imageUrl?: string
  priceMin?: number
  priceMax?: number
  sortOrder?: number
}

export type UpdateShowcaseDto = {
  title?: string
  description?: string
  imageUrl?: string
  priceMin?: number
  priceMax?: number
  isActive?: boolean
  sortOrder?: number
}

export type ReportUserDto = {
  /** Report category */
  category: "FRAUD" | "FAKE_IDENTITY" | "INAPPROPRIATE_CONTENT" | "TNC_VIOLATION" | "MONEY_LAUNDERING" | "SPAM" | "OTHER"
  /**
   * Report description
   * minLength 20 · maxLength 500
   */
  description: string
  /** Evidence URLs (must be platform storage URLs) */
  evidenceUrls?: Array<string>
  /** Related order ID */
  relatedOrderId?: string
}

export type AskQuestionDto = {
  /**
   * Question content
   * minLength 5 · maxLength 500
   */
  question: string
}

export type AnswerQuestionDto = {
  /**
   * Answer content
   * minLength 1 · maxLength 2000
   */
  answer: string
}

export type AddCommentDto = {
  /**
   * Comment content
   * minLength 1 · maxLength 1000
   */
  content: string
  /** Parent comment ID for threaded replies */
  parentId?: string
}

export type SubmitKycDto = {
  /**
   * S3 fileKey from confirmed KTP upload (format: uploads/kyc-ktp/{userId}/{filename})
   * contoh "uploads/kyc-ktp/user123/1700000000_abc123.jpg"
   */
  ktpFileKey: string
  /**
   * S3 fileKey from confirmed selfie upload (format: uploads/kyc-selfie/{userId}/{filename})
   * contoh "uploads/kyc-selfie/user123/1700000000_def456.jpg"
   */
  selfieFileKey: string
  /**
   * NIK (exactly 16 digits)
   * pattern ^\d{16}$
   */
  nik: string
}

export type PresignedUrlDto = {
  /** Upload purpose determines allowed content types, max file size, and URL expiry duration */
  purpose: "KYC_KTP" | "KYC_SELFIE" | "AVATAR" | "CHAT_ATTACHMENT" | "DISPUTE_EVIDENCE" | "REPORT_EVIDENCE" | "DELIVERY_PROOF"
  /** contoh "photo.jpg" */
  fileName: string
  /** contoh "image/jpeg" */
  contentType: string
  /**
   * Exact file size in bytes. Must be within the allowed range for the upload purpose.
   * contoh 102400
   */
  fileSize: number
}

export type ConfirmUploadDto = {
  /** contoh "uploads/kyc-ktp/usr123/1234567890-photo.jpg" */
  fileKey: string
  /**
   * SHA-256 hash of the uploaded file for integrity verification
   * contoh "a1b2c3..."
   */
  sha256?: string
}

export type CleanupFilesDto = Record<string, never>

export type AddBankAccountDto = {
  /** Bank code (must match BankCode enum) */
  bankCode: "BCA" | "BNI" | "BRI" | "MANDIRI" | "CIMB" | "PERMATA" | "DANAMON" | "OCBC" | "PANIN" | "MEGA" | "BTN" | "BSI" | "MAYBANK" | "OTHER"
  /**
   * Bank name
   * minLength 2 · maxLength 100
   */
  bankName: string
  /**
   * Account number (6-20 digits)
   * pattern ^\d{6,20}$
   */
  accountNumber: string
  /**
   * Account holder name
   * minLength 2 · maxLength 100
   */
  accountName: string
}

export type MidtransNotificationDto = {
  /** Order ID from Midtrans */
  order_id: string
  /** Status code */
  status_code: string
  /** Gross amount */
  gross_amount: string
  /** Signature key for verification */
  signature_key: string
  /** Transaction status */
  transaction_status: string
  /** Transaction ID */
  transaction_id: string
  /** Payment type */
  payment_type?: string
  /** Fraud status */
  fraud_status?: string
  /** Cumulative amount refunded by Midtrans, for refund and partial_refund notifications */
  refund_amount?: string
  /** Merchant refund reference used to make refund webhook delivery idempotent */
  refund_key?: string
}

export type TopupDto = {
  /**
   * Top-up amount in IDR
   * min 10000 · max 50000000
   */
  amount: number
  /** Payment method (KAHADE_WALLET not available for top-up) */
  method: "VIRTUAL_ACCOUNT_BCA" | "VIRTUAL_ACCOUNT_BNI" | "VIRTUAL_ACCOUNT_BRI" | "VIRTUAL_ACCOUNT_MANDIRI" | "VIRTUAL_ACCOUNT_CIMB" | "VIRTUAL_ACCOUNT_PERMATA" | "VIRTUAL_ACCOUNT_OTHER" | "QRIS" | "GOPAY" | "SHOPEEPAY" | "OVO" | "DANA" | "LINKAJA" | "CREDIT_CARD" | "ALFAMART" | "INDOMARET" | "AKULAKU" | "KREDIVO"
  /** Card token from Midtrans.js tokenization (required for CREDIT_CARD method) */
  cardToken?: string
  /** Wallet PIN (6 digits) — collected by mobile but not verified for top-up */
  pin?: string
}

export type WithdrawDto = {
  /**
   * Withdrawal amount in IDR
   * min 50000 · max 50000000
   */
  amount: number
  /** Bank account ID for withdrawal */
  bankAccountId: string
  /** 6-digit wallet PIN for withdrawal authorization */
  pin: string
}

export type TransferDto = {
  /** Recipient user ID or username */
  recipientId: string
  /**
   * Transfer amount in IDR
   * min 1000 · max 25000000
   */
  amount: number
  /** 6-digit wallet PIN for transfer authorization */
  pin: string
  /** Optional note for the transfer */
  note?: string
}

export type ConfirmWithdrawOtpDto = {
  /** Transaction ID */
  txId: string
  /**
   * OTP code (6 digits)
   * minLength 6 · maxLength 6
   */
  otp: string
}

export type ResendWithdrawOtpDto = {
  /** Transaction ID of the pending withdrawal */
  txId: string
}

export type SetPinDto = {
  /**
   * New wallet PIN (6 digits)
   * minLength 6 · maxLength 6
   */
  pin: string
  /**
   * Current wallet PIN — required when changing an existing PIN
   * minLength 6 · maxLength 6
   */
  currentPin?: string
  /** Account password — required when changing an existing PIN */
  password: string
}

export type VerifyPinDto = {
  /**
   * Wallet PIN to verify (6 digits)
   * minLength 6 · maxLength 6
   */
  pin: string
}

export type CalculateFeeDto = {
  /**
   * Order value in IDR
   * min 10000 · max 1000000000
   */
  orderValue: number
  /** Who pays the fee */
  feeResponsibility: "BUYER" | "SELLER" | "SPLIT"
  /**
   * Voucher code to apply
   * maxLength 50
   */
  voucherCode?: string
  /** User role for role-based voucher validation */
  role?: "BUYER" | "SELLER"
}

export type ValidateCounterpartDto = {
  /**
   * Username to validate
   * minLength 3 · maxLength 50
   */
  username: string
}

export type CreateOrderDto = {
  /** Your role in the order */
  role: "BUYER" | "SELLER"
  /**
   * Username of the counterpart
   * minLength 3 · maxLength 50
   */
  counterpartUsername: string
  /**
   * Order title
   * minLength 3 · maxLength 100
   */
  title: string
  /**
   * Order description
   * minLength 10 · maxLength 500
   */
  description: string
  /** Type of order */
  orderType: "PHYSICAL_GOODS" | "DIGITAL_GOODS" | "SERVICE" | "OTHER"
  /**
   * Order value in IDR
   * min 10000 · max 1000000000
   */
  orderValue: number
  /**
   * Delivery deadline in days
   * min 1 · max 14
   */
  deliveryDeadlineDays: number
  /** Who pays the fee */
  feeResponsibility: "BUYER" | "SELLER" | "SPLIT"
  /**
   * Voucher code to apply
   * maxLength 50
   */
  voucherCode?: string
}

export type ConfirmOrderDto = {
  /** Accept or reject the order */
  action: "ACCEPT" | "REJECT"
  /**
   * Reason for rejection
   * maxLength 500
   */
  reason?: string
}

export type PayOrderDto = {
  /** 6-digit wallet PIN for payment authorization */
  pin: string
}

export type UpdateShippingDto = {
  /**
   * Tracking number; required for PHYSICAL_GOODS only
   * minLength 3 · maxLength 100
   */
  trackingNumber?: string
  /**
   * Courier name; required for PHYSICAL_GOODS only
   * minLength 2 · maxLength 100
   */
  courierName?: string
  /**
   * Tracking notes
   * maxLength 500
   */
  trackingNotes?: string
}

export type CancelOrderDto = {
  /** Cancellation reason */
  reason: "CHANGED_MIND" | "WRONG_DETAILS" | "DUPLICATE_ORDER" | "MUTUAL_AGREEMENT" | "COUNTERPART_UNRESPONSIVE" | "OTHER"
  /**
   * Additional cancellation note
   * maxLength 500
   */
  note?: string
}

export type RequestExtensionDto = {
  /**
   * Number of extension days
   * min 1 · max 14
   */
  extensionDays: number
  /**
   * Reason for extension
   * minLength 10 · maxLength 500
   */
  reason: string
}

export type RespondExtensionDto = {
  /** Approve or reject extension */
  action: "APPROVE" | "REJECT"
  /**
   * Response note
   * maxLength 500
   */
  note?: string
}

export type SubmitDisputeDto = {
  /**
   * Dispute claim
   * minLength 20 · maxLength 2000
   */
  claim: string
  /**
   * Evidence file URLs
   * minItems 0 · maxItems 10
   */
  fileUrls?: Array<string>
  /**
   * Evidence file MIME types
   * maxItems 10
   */
  fileTypes?: Array<string>
}

export type CreateOrderLinkDto = {
  role: "BUYER" | "SELLER"
  /** minLength 3 · maxLength 100 */
  title: string
  /** minLength 10 · maxLength 500 */
  description: string
  orderType: "PHYSICAL_GOODS" | "DIGITAL_GOODS" | "SERVICE" | "OTHER"
  /** min 10000 · max 1000000000 */
  orderValue: number
  /** min 1 · max 14 */
  deliveryDeadlineDays: number
  feeResponsibility: "BUYER" | "SELLER" | "SPLIT"
  /** maxLength 50 */
  counterpartUsername?: string
}

export type SubmitDeliveryProofDto = {
  /**
   * Description of the delivery proof
   * minLength 10 · maxLength 2000
   */
  description: string
  /**
   * S3 object keys for proof files
   * maxItems 10
   */
  fileUrls?: Array<string>
  /**
   * Link URLs for proof
   * maxItems 5
   */
  linkUrls?: Array<string>
}

export type ConfirmDeliveryDto = {
  /**
   * Specific submitted delivery proof to review
   * pattern ^c[a-z0-9]{24}$
   */
  proofId?: string
}

export type RejectDeliveryDto = {
  /**
   * Reason for rejecting delivery
   * minLength 10 · maxLength 1000
   */
  note: string
  /**
   * Specific submitted delivery proof to reject
   * pattern ^c[a-z0-9]{24}$
   */
  proofId?: string
}

export type ApplyReferralDto = {
  /**
   * Referral code (format: KH followed by 6-8 alphanumeric characters)
   * pattern ^KH[A-Z0-9]{6,8}$
   */
  code: string
}

export type SubmitEvidenceDto = {
  /**
   * Evidence description
   * maxLength 2000
   */
  description: string
  /**
   * Evidence file URLs
   * minItems 1 · maxItems 10
   */
  fileUrls: Array<string>
  /**
   * File types (MIME)
   * minItems 1 · maxItems 10
   */
  fileTypes: Array<"image/jpeg" | "image/png" | "image/webp" | "application/pdf">
}

export type SubmitClaimDto = {
  /**
   * Dispute claim description
   * minLength 20 · maxLength 5000
   */
  claim: string
}

export type DisputeMessageDto = Record<string, never>

export type CallActionDto = Record<string, never>

export type MutualResolutionProposeDto = Record<string, never>

export type MutualResolutionRespondDto = Record<string, never>

export type ChatAttachmentDto = {
  /**
   * File name
   * maxLength 255
   */
  fileName: string
  /**
   * File URL (must be HTTPS; trusted storage domain enforced at service layer)
   * maxLength 512
   */
  fileUrl: string
  /** MIME type */
  mimeType: string
  /**
   * Thumbnail URL (must be HTTPS; trusted storage domain enforced at service layer)
   * maxLength 512
   */
  thumbnailUrl?: string
  /**
   * File size in bytes
   * min 1 · max 10485760
   */
  fileSize: number
}

export type SendMessageDto = {
  /**
   * Message type (TEXT, IMAGE, or FILE). SYSTEM is reserved for internal use.
   * default "TEXT"
   */
  messageType?: "TEXT" | "IMAGE" | "FILE"
  /**
   * Message content
   * maxLength 2000
   */
  content?: string
  /** Message attachments */
  attachments?: Array<ChatAttachmentDto>
  /** ID of the message being replied to */
  replyToId?: string
}

export type BatchNotificationIdsDto = {
  /** Array of notification IDs to operate on (max 50 per request) */
  notifIds: Array<string>
}

export type UpdatePreferencesDto = {
  /** Order in-app notifications */
  orderInApp?: boolean
  /** Order push notifications */
  orderPush?: boolean
  /** Order email notifications */
  orderEmail?: boolean
  /** Wallet in-app notifications */
  walletInApp?: boolean
  /** Wallet push notifications */
  walletPush?: boolean
  /** Wallet email notifications */
  walletEmail?: boolean
  /** Security in-app notifications */
  securityInApp?: boolean
  /** Security push notifications */
  securityPush?: boolean
  /** Security email notifications */
  securityEmail?: boolean
  /** Chat in-app notifications */
  chatInApp?: boolean
  /** Chat push notifications */
  chatPush?: boolean
  /** Dispute in-app notifications */
  disputeInApp?: boolean
  /** Dispute push notifications */
  disputePush?: boolean
  /** Dispute email notifications */
  disputeEmail?: boolean
  /** Ranking in-app notifications */
  rankingInApp?: boolean
  /** Ranking push notifications */
  rankingPush?: boolean
  /** Marketing email notifications */
  marketingEmail?: boolean
}

export type RegisterDeviceDto = {
  /**
   * Push notification token
   * maxLength 512
   */
  token: string
  /** Device platform */
  platform?: "android" | "ios" | "web"
  /**
   * Stable per-install device fingerprint
   * maxLength 128
   */
  deviceId?: string
}

export type CreateRatingDto = {
  /** Order ID to rate */
  orderId: string
  /**
   * Star rating
   * min 1 · max 5
   */
  stars: number
  /**
   * Rating comment
   * maxLength 500
   */
  comment?: string
}

export type UpdateRatingDto = {
  /**
   * Star rating
   * min 1 · max 5
   */
  stars?: number
  /**
   * Rating comment
   * maxLength 500
   */
  comment?: string
}

export type RatingReplyDto = {
  /**
   * Reply content
   * maxLength 500
   */
  content: string
}

export type ValidateVoucherDto = {
  /**
   * Voucher code
   * maxLength 50
   */
  code: string
  /**
   * Order value in IDR (optional for preview validation)
   * min 1
   */
  orderValue?: number
  /** User role for role-based voucher validation */
  userRole?: "BUYER" | "SELLER"
}

export type SubscribeDto = {
  /** Subscription plan */
  plan: "MONTHLY" | "ANNUAL"
  /** Wallet PIN for payment verification */
  pin: string
  /** Payment method */
  paymentMethod?: "VIRTUAL_ACCOUNT_BCA" | "VIRTUAL_ACCOUNT_BNI" | "VIRTUAL_ACCOUNT_BRI" | "VIRTUAL_ACCOUNT_MANDIRI" | "VIRTUAL_ACCOUNT_CIMB" | "VIRTUAL_ACCOUNT_PERMATA" | "VIRTUAL_ACCOUNT_OTHER" | "QRIS" | "GOPAY" | "SHOPEEPAY" | "OVO" | "DANA" | "LINKAJA" | "CREDIT_CARD" | "ALFAMART" | "INDOMARET" | "AKULAKU" | "KREDIVO" | "KAHADE_WALLET"
}

export type RenewDto = {
  /** Wallet PIN for payment verification */
  pin: string
}

export type ReportUserSettingsDto = {
  /** ID of the user being reported */
  targetId: string
  /** Report category */
  category: "FRAUD" | "FAKE_IDENTITY" | "INAPPROPRIATE_CONTENT" | "TNC_VIOLATION" | "MONEY_LAUNDERING" | "SPAM" | "OTHER"
  /**
   * Report description
   * maxLength 500
   */
  description: string
  /**
   * Evidence URLs
   * maxItems 10
   */
  evidenceUrls?: Array<string>
  /** Related order ID */
  relatedOrderId?: string
  /** Related message ID */
  relatedMessageId?: string
}

export type UpdatePrivacyDto = {
  /** Profile visibility */
  profileVisible?: boolean
  /** Show online status */
  showOnlineStatus?: boolean
}

export type UpdateLanguageDto = {
  /**
   * Language code
   * contoh "id"
   */
  language: "id" | "en"
}

export type CreateScheduleDto = {
  /** Bank account ID to withdraw to */
  bankAccountId: string
  /**
   * Day of week (0=Sunday, 6=Saturday)
   * min 0 · max 6
   */
  dayOfWeek: number
  /**
   * Minimum balance to trigger withdrawal
   * min 1
   */
  minAmount?: number
}

export type UpdateScheduleDto = {
  /**
   * Day of week (0=Sunday, 6=Saturday)
   * min 0 · max 6
   */
  dayOfWeek?: number
  /**
   * Minimum balance to trigger withdrawal
   * min 1
   */
  minAmount?: number
  /** Whether the schedule is active */
  isActive?: boolean
  /** Bank account ID to withdraw to */
  bankAccountId?: string
}

export type CreateTemplateDto = Record<string, never>

export type UpdateTemplateDto = Record<string, never>

export type CreateTicketDto = {
  /** Attachment file keys (max 5) */
  attachments?: Array<string>
}

export type ReplyTicketDto = Record<string, never>
