/**
 * FORM VALIDATION SCHEMAS
 * 
 * SECURITY FIX [FE-FORM-001]: Forms Without Validation
 * 
 * This module provides comprehensive validation schemas for all forms
 * using Zod for type-safe validation.
 */

import { z } from 'zod';

// === COMMON VALIDATORS ===

/**
 * Email validator
 */
export const emailSchema = z
 .string()
 .min(1, 'Email wajib diisi')
 .email('Format email tidak valid')
 .toLowerCase()
 .trim();

/**
 * Password validator - strong password requirements
 */
export const passwordSchema = z
 .string()
 .min(8, 'Password minimal 8 karakter')
 .max(128, 'Password maksimal 128 karakter')
 .regex(
 /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
 'Password harus mengandung huruf besar, huruf kecil, dan angka'
 );

/**
 * Simple password for login (no complexity requirement)
 */
export const loginPasswordSchema = z
 .string()
 .min(1, 'Password wajib diisi');

/**
 * Phone number validator (Indonesian format)
 */
export const phoneSchema = z
 .string()
 .regex(
 /^(\+62|62|0)[0-9]{9,12}$/,
 'Nomor telepon tidak valid (contoh: 081234567890)'
 )
 .optional()
 .or(z.literal(''));

/**
 * Username validator
 */
export const usernameSchema = z
 .string()
 .min(3, 'Username minimal 3 karakter')
 .max(30, 'Username maksimal 30 karakter')
 .regex(
 /^[a-zA-Z0-9_-]+$/,
 'Username hanya boleh mengandung huruf, angka, underscore, dan dash'
 )
 .toLowerCase()
 .trim();

/**
 * Amount validator (positive number, min 10000)
 */
export const amountSchema = z
 .number({
 required_error: 'Jumlah wajib diisi',
 invalid_type_error: 'Jumlah harus berupa angka',
 })
 .positive('Jumlah harus lebih dari 0')
 .min(10000, 'Jumlah minimal Rp 10.000')
 .max(1000000000, 'Jumlah maksimal Rp 1.000.000.000');

/**
 * Bank account number validator
 */
export const bankAccountNumberSchema = z
 .string()
 .min(8, 'Nomor rekening minimal 8 digit')
 .max(20, 'Nomor rekening maksimal 20 digit')
 .regex(/^[0-9]+$/, 'Nomor rekening hanya boleh angka');

// === AUTH SCHEMAS ===

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
 email: emailSchema,
 password: loginPasswordSchema,
 mfaCode: z.string().optional(),
 rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Register form validation schema
 */
export const registerSchema = z
 .object({
 email: emailSchema,
 username: usernameSchema,
 password: passwordSchema,
 confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
 phone: phoneSchema,
 referralCode: z.string().optional(),
 agreeToTerms: z.boolean().refine(val => val === true, {
 message: 'Anda harus menyetujui syarat dan ketentuan',
 }),
 })
 .refine(data => data.password === data.confirmPassword, {
 message: 'Password tidak cocok',
 path: ['confirmPassword'],
 });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Forgot password form validation schema
 */
export const forgotPasswordSchema = z.object({
 email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password form validation schema
 */
export const resetPasswordSchema = z
 .object({
 password: passwordSchema,
 confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
 })
 .refine(data => data.password === data.confirmPassword, {
 message: 'Password tidak cocok',
 path: ['confirmPassword'],
 });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Change password form validation schema
 */
export const changePasswordSchema = z
 .object({
 currentPassword: z.string().min(1, 'Password lama wajib diisi'),
 newPassword: passwordSchema,
 confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
 })
 .refine(data => data.newPassword === data.confirmPassword, {
 message: 'Password baru tidak cocok',
 path: ['confirmPassword'],
 })
 .refine(data => data.currentPassword !== data.newPassword, {
 message: 'Password baru harus berbeda dari password lama',
 path: ['newPassword'],
 });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// === TRANSACTION SCHEMAS ===

/**
 * Create transaction form validation schema
 */
export const createTransactionSchema = z.object({
 counterpartyEmail: emailSchema.optional(),
 counterpartyId: z.string().optional(),
 role: z.enum(['buyer', 'seller'], {
 required_error: 'Peran wajib dipilih',
 }),
 title: z
 .string()
 .min(5, 'Judul minimal 5 karakter')
 .max(100, 'Judul maksimal 100 karakter')
 .trim(),
 description: z
 .string()
 .min(10, 'Deskripsi minimal 10 karakter')
 .max(1000, 'Deskripsi maksimal 1000 karakter')
 .trim(),
 category: z.string().min(1, 'Kategori wajib dipilih'),
 amount: amountSchema,
 feePaidBy: z.enum(['buyer', 'seller', 'split'], {
 required_error: 'Pembayaran fee wajib dipilih',
 }),
 terms: z.string().max(500, 'Syarat maksimal 500 karakter').optional(),
});

export type CreateTransactionFormData = z.infer<typeof createTransactionSchema>;

/**
 * Dispute form validation schema
 */
export const disputeSchema = z.object({
 reason: z.string().min(1, 'Alasan wajib dipilih'),
 description: z
 .string()
 .min(20, 'Deskripsi minimal 20 karakter')
 .max(1000, 'Deskripsi maksimal 1000 karakter')
 .trim(),
});

export type DisputeFormData = z.infer<typeof disputeSchema>;

// === PROFILE SCHEMAS ===

/**
 * Edit profile form validation schema
 */
export const editProfileSchema = z.object({
 username: usernameSchema.optional(),
 phone: phoneSchema,
 bio: z.string().max(200, 'Bio maksimal 200 karakter').optional(),
});

export type EditProfileFormData = z.infer<typeof editProfileSchema>;

// === WALLET SCHEMAS ===

/**
 * Top up wallet form validation schema
 */
export const topUpSchema = z.object({
 amount: amountSchema,
 method: z.string().min(1, 'Metode pembayaran wajib dipilih'),
});

export type TopUpFormData = z.infer<typeof topUpSchema>;

/**
 * Withdraw form validation schema
 */
export const withdrawSchema = z.object({
 amount: amountSchema,
 bankAccountId: z.string().min(1, 'Rekening bank wajib dipilih'),
});

export type WithdrawFormData = z.infer<typeof withdrawSchema>;

/**
 * Bank account form validation schema
 */
export const bankAccountSchema = z.object({
 bankCode: z.string().min(1, 'Bank wajib dipilih'),
 accountNumber: bankAccountNumberSchema,
 accountHolderName: z
 .string()
 .min(3, 'Nama pemegang rekening minimal 3 karakter')
 .max(100, 'Nama pemegang rekening maksimal 100 karakter')
 .regex(
 /^[a-zA-Z\s.'-]+$/,
 'Nama hanya boleh mengandung huruf, spasi, titik, apostrof, dan dash'
 )
 .trim(),
});

export type BankAccountFormData = z.infer<typeof bankAccountSchema>;

// === CONTACT SCHEMAS ===

/**
 * Contact form validation schema
 */
export const contactSchema = z.object({
 name: z
 .string()
 .min(3, 'Nama minimal 3 karakter')
 .max(100, 'Nama maksimal 100 karakter')
 .trim(),
 email: emailSchema,
 subject: z
 .string()
 .min(5, 'Subjek minimal 5 karakter')
 .max(100, 'Subjek maksimal 100 karakter')
 .trim(),
 message: z
 .string()
 .min(20, 'Pesan minimal 20 karakter')
 .max(1000, 'Pesan maksimal 1000 karakter')
 .trim(),
});

export type ContactFormData = z.infer<typeof contactSchema>;

/**
 * Feedback form validation schema
 */
export const feedbackSchema = z.object({
 rating: z
 .number()
 .min(1, 'Rating minimal 1')
 .max(5, 'Rating maksimal 5')
 .int('Rating harus bilangan bulat'),
 category: z.string().min(1, 'Kategori wajib dipilih'),
 comment: z
 .string()
 .min(10, 'Komentar minimal 10 karakter')
 .max(500, 'Komentar maksimal 500 karakter')
 .trim(),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;

// === KYC SCHEMAS ===

/**
 * KYC verification form validation schema
 */
export const kycSchema = z.object({
 idType: z.enum(['ktp', 'passport', 'sim'], {
 required_error: 'Jenis identitas wajib dipilih',
 }),
 idNumber: z
 .string()
 .min(8, 'Nomor identitas minimal 8 karakter')
 .max(20, 'Nomor identitas maksimal 20 karakter')
 .regex(/^[A-Z0-9]+$/, 'Nomor identitas hanya boleh huruf kapital dan angka'),
 fullName: z
 .string()
 .min(3, 'Nama lengkap minimal 3 karakter')
 .max(100, 'Nama lengkap maksimal 100 karakter')
 .trim(),
 dateOfBirth: z.string().min(1, 'Tanggal lahir wajib diisi'),
 address: z
 .string()
 .min(10, 'Alamat minimal 10 karakter')
 .max(200, 'Alamat maksimal 200 karakter')
 .trim(),
});

export type KYCFormData = z.infer<typeof kycSchema>;

// === RATING SCHEMAS ===

/**
 * Rating form validation schema
 */
export const ratingSchema = z.object({
 score: z
 .number()
 .min(1, 'Rating minimal 1')
 .max(5, 'Rating maksimal 5')
 .int('Rating harus bilangan bulat'),
 comment: z
 .string()
 .max(500, 'Komentar maksimal 500 karakter')
 .optional()
 .or(z.literal('')),
});

export type RatingFormData = z.infer<typeof ratingSchema>;

// === HELPER FUNCTIONS ===

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeInput(input: string): string {
 return input
 .trim()
 .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
 .replace(/<[^>]+>/g, '') // Remove HTML tags
 .replace(/javascript:/gi, '') // Remove javascript: protocol
 .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Validate and sanitize form data
 */
export function validateAndSanitize<T extends z.ZodType>(
 schema: T,
 data: unknown
): z.infer<T> {
 const result = schema.safeParse(data);
 
 if (!result.success) {
 throw new Error('Validation failed');
 }
 
 return result.data;
}
