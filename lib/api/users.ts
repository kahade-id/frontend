/**
 * Kahade — domain `users` (tag "users" di kahade-api-mobile.json).
 *
 * Hanya endpoint yang dipakai alur auth (setup profil) dan navigasi dasar
 * yang diimplementasikan di sini. Endpoint lain (follow, block, report,
 * showcase, questions, analytics, dll) ditambahkan saat screen terkait
 * dibangun — mengikuti aturan "jangan implementasi yang belum dipakai".
 *
 * Semua endpoint di sini memakai `auth: "required"` (butuh Bearer token).
 *
 * Keputusan non-obvious:
 *   - `updateProfile` hanya mengirim field yang diisi (partial update).
 *     DTO class-validator menerima field opsional yang di-omit.
 *   - Avatar upload mengikuti pola 2 langkah: `uploadAvatarDirect` (multipart)
 *     → `confirmAvatar` (key). Spec menyediakan `PUT /v1/users/me/avatar`
 *     untuk presigned URL, tapi direct upload lebih simple untuk mobile
 *     (tidak perlu round-trip presigned URL).
 */
import { http } from "@/lib/api/client"
import type { ConfirmAvatarDto, UpdateProfileDto } from "@/lib/api/types"

// ------------------------------------------------------------------
// Tipe response — UNVERIFIED (spec auth tidak menyertakan response schema)
// ------------------------------------------------------------------

/** Profil user — subset field yang dipakai UI. */
export type UserProfile = {
  id: string
  fullName?: string
  username?: string | null
  email?: string
  emailVerified?: boolean
  phoneNumber?: string | null
  avatarUrl?: string | null
  bio?: string | null
  accountType?: "PERSONAL" | "BUSINESS"
}

export type AvatarResult = {
  avatarUrl: string
  avatarKey?: string
}

// ------------------------------------------------------------------
// Profil
// ------------------------------------------------------------------

/** GET /v1/users/me — profil lengkap user yang sedang login. */
export function getMe() {
  return http.get<UserProfile>("/v1/users/me", { auth: "required" })
}

/**
 * PUT /v1/users/me — update profil (partial).
 * Hanya field yang diisi yang dikirim; sisanya tidak berubah.
 */
export function updateProfile(dto: UpdateProfileDto) {
  return http.put<UserProfile, UpdateProfileDto>("/v1/users/me", dto, { auth: "required" })
}

// ------------------------------------------------------------------
// Avatar
// ------------------------------------------------------------------

/**
 * POST /v1/users/me/avatar/direct — upload avatar langsung lewat server
 * (multipart/form-data). Bypasses presigned URL — lebih simple untuk mobile.
 *
 * File harus sudah divalidasi klien (JPG/PNG, maks 10MB, idealnya < 2MB
 * setelah kompresi — §9.19). Server yang menangani kompresi jika perlu.
 */
export function uploadAvatarDirect(formData: FormData) {
  return http.post<AvatarResult>("/v1/users/me/avatar/direct", undefined, {
    auth: "required",
    formData,
  })
}

/** POST /v1/users/me/avatar/confirm — konfirmasi avatar yang sudah di-upload. */
export function confirmAvatar(dto: ConfirmAvatarDto) {
  return http.post<AvatarResult, ConfirmAvatarDto>("/v1/users/me/avatar/confirm", dto, {
    auth: "required",
  })
}

/** DELETE /v1/users/me/avatar — hapus avatar (kembali ke inisial default). */
export function deleteAvatar() {
  return http.delete<void>("/v1/users/me/avatar", { auth: "required", responseType: "void" })
}
