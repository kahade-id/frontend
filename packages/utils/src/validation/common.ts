import { z } from 'zod';

// Common validation rules
export const emailSchema = z.string()
 .min(1, 'Email wajib diisi')
 .email('Format email tidak valid');

export const passwordSchema = z.string()
 .min(8, 'Password minimal 8 karakter')
 .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
 .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
 .regex(/[0-9]/, 'Password harus mengandung angka');

export const strongPasswordSchema = z.string()
 .min(12, 'Password minimal 12 karakter untuk keamanan maksimal')
 .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
 .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
 .regex(/[0-9]/, 'Password harus mengandung angka')
 .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password harus mengandung karakter khusus');

export const phoneSchema = z.string()
 .regex(/^(\+62|62|0)[0-9]{9,13}$/, 'Nomor telepon tidak valid')
 .optional()
 .or(z.literal(''));

export const requiredPhoneSchema = z.string()
 .min(1, 'Nomor telepon wajib diisi')
 .regex(/^(\+62|62|0)[0-9]{9,13}$/, 'Nomor telepon tidak valid');

export const amountSchema = z.number()
 .positive('Jumlah harus lebih dari 0')
 .max(1000000000, 'Jumlah terlalu besar (maksimal 1 miliar)');

export const usernameSchema = z.string()
 .min(3, 'Username minimal 3 karakter')
 .max(30, 'Username maksimal 30 karakter')
 .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore');

export const nameSchema = z.string()
 .min(2, 'Nama minimal 2 karakter')
 .max(100, 'Nama maksimal 100 karakter')
 .regex(/^[a-zA-Z\s]+$/, 'Nama hanya boleh huruf dan spasi');

export const otpSchema = z.string()
 .length(6, 'Kode OTP harus 6 digit')
 .regex(/^\d+$/, 'Kode OTP hanya boleh angka');

export const bankAccountNumberSchema = z.string()
 .min(10, 'Nomor rekening minimal 10 digit')
 .max(20, 'Nomor rekening maksimal 20 digit')
 .regex(/^\d+$/, 'Nomor rekening hanya boleh angka');

export const urlSchema = z.string()
 .url('Format URL tidak valid')
 .optional()
 .or(z.literal(''));

export const dateSchema = z.string()
 .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

// Composite schemas for forms
export const loginSchema = z.object({
 email: emailSchema,
 password: z.string().min(1, 'Password wajib diisi'),
});

export const registerSchema = z.object({
 username: usernameSchema,
 email: emailSchema,
 password: passwordSchema,
 confirmPassword: z.string(),
 phone: phoneSchema,
 referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
 message: "Password tidak cocok",
 path: ["confirmPassword"],
});

export const withdrawalSchema = z.object({
 amount: amountSchema,
 bankAccountId: z.string().min(1, 'Rekening bank wajib dipilih'),
 notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

export const depositSchema = z.object({
 amount: amountSchema,
 paymentMethod: z.enum(['BANK_TRANSFER', 'EWALLET', 'RETAIL']),
 notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});
