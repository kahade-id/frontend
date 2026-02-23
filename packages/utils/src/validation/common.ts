import { z } from 'zod';

// NOTE: emailSchema, passwordSchema, phoneSchema, usernameSchema, amountSchema,
// bankAccountNumberSchema, loginSchema, registerSchema have been removed from
// this file. They are exported by ./schemas (the canonical, more complete version)
// and re-exported via index.ts. Keeping them here caused TS2308 duplicate export errors.

// ============================================================================
// VALIDATORS UNIQUE TO THIS FILE
// ============================================================================

/**
 * Strong password — requires special character (stricter than passwordSchema in schemas.ts)
 */
export const strongPasswordSchema = z.string()
  .min(12, 'Password minimal 12 karakter untuk keamanan maksimal')
  .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
  .regex(/[0-9]/, 'Password harus mengandung angka')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password harus mengandung karakter khusus');

/**
 * Required phone number (non-optional variant)
 */
export const requiredPhoneSchema = z.string()
  .min(1, 'Nomor telepon wajib diisi')
  .regex(/^(\+62|62|0)[0-9]{9,13}$/, 'Nomor telepon tidak valid');

/**
 * Full name validator
 */
export const nameSchema = z.string()
  .min(2, 'Nama minimal 2 karakter')
  .max(100, 'Nama maksimal 100 karakter')
  .regex(/^[a-zA-Z\s]+$/, 'Nama hanya boleh huruf dan spasi');

/**
 * OTP code validator
 */
export const otpSchema = z.string()
  .length(6, 'Kode OTP harus 6 digit')
  .regex(/^\d+$/, 'Kode OTP hanya boleh angka');

/**
 * URL validator (optional)
 */
export const urlSchema = z.string()
  .url('Format URL tidak valid')
  .optional()
  .or(z.literal(''));

/**
 * Date string validator (YYYY-MM-DD format)
 */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

/**
 * Withdrawal form schema (with optional notes field — distinct from withdrawSchema in schemas.ts)
 */
export const withdrawalSchema = z.object({
  amount: z.number()
    .positive('Jumlah harus lebih dari 0')
    .max(1000000000, 'Jumlah terlalu besar (maksimal 1 miliar)'),
  bankAccountId: z.string().min(1, 'Rekening bank wajib dipilih'),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

/**
 * Deposit form schema
 */
export const depositSchema = z.object({
  amount: z.number()
    .positive('Jumlah harus lebih dari 0')
    .max(1000000000, 'Jumlah terlalu besar (maksimal 1 miliar)'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'EWALLET', 'RETAIL']),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});
