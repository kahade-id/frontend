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
import { http, seg } from "@/lib/api/client"
import type { ConfirmAvatarDto, RequestAccountDeletionDto, UpdateLinksDto, UpdateProfileDto, UserLinkItemDto } from "@/lib/api/types"

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

/** POST /v1/users/me/delete-request — minta penghapusan akun. */
export function requestAccountDeletion(dto: RequestAccountDeletionDto) {
  return http.post<{ message: string }, RequestAccountDeletionDto>("/v1/users/me/delete-request", dto, {
    auth: "required",
  })
}

/** GET /v1/users/me/links — tautan sosial profil. */
export function getLinks() {
  return http.get<UserLinkItemDto[]>("/v1/users/me/links", { auth: "required", retry: 1 })
}

/** PUT /v1/users/me/links — ganti semua tautan sosial. */
export function updateLinks(dto: UpdateLinksDto) {
  return http.put<UserLinkItemDto[], UpdateLinksDto>("/v1/users/me/links", dto, {
    auth: "required",
  })
}

/** GET /v1/users/{username} — profil publik user. */
export function getUserByUsername(username: string) {
  return http.get<PublicUserProfile>(`/v1/users/${seg(username)}`, { auth: "required", retry: 1 })
}

export type PublicUserProfile = {
  id: string
  username?: string | null
  fullName?: string
  bio?: string | null
  avatarUrl?: string | null
  verified?: boolean
  trustScore?: number
  rating?: number
  createdAt?: string
  showcase?: unknown
  ratings?: unknown
}
