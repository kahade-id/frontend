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

// ------------------------------------------------------------------
// Analitik & skor kepercayaan
// ------------------------------------------------------------------

export type UserStats = {
  transactions: number
  completedOrders?: number
  followers?: number
  following?: number
  rating?: number
  reviews?: number
}

export type AnalyticsPoint = { label: string; value: number }
export type UserAnalytics = {
  summary?: Record<string, number>
  volumeByPeriod?: Array<{ label: string; value: number }>
  revenueByPeriod?: Array<{ label: string; value: number }>
  avgOrderValue?: number
  completionRate?: number
}

export function getMyStats() {
  return http.get<UserStats>("/v1/users/me/stats", { auth: "required", retry: 1 })
}

export function getMyAnalytics() {
  return http.get<UserAnalytics>("/v1/users/me/analytics", { auth: "required", retry: 1 })
}

export function getMyTrustScore() {
  return http.get<{ score: number; tier?: string; factors?: Array<{ key: string; label: string; value: number; max: number }>; updatedAt?: string }>(
    "/v1/users/me/trust-score",
    { auth: "required", retry: 1 },
  )
}

export function getMyDashboard() {
  return http.get<Record<string, unknown>>("/v1/users/me/dashboard", { auth: "required", retry: 1 })
}

// ------------------------------------------------------------------
// Discover & favorites
// ------------------------------------------------------------------

export type DiscoveredUser = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
  verified?: boolean
  transactionCount?: number
  rating?: number
  following?: boolean
}

export function discoverUsers(query?: { page?: number; limit?: number; sort?: string }) {
  return http.get<DiscoveredUser[]>("/v1/users/discover", { query, auth: "required", retry: 1 })
}

export function getFavorites() {
  return http.get<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>>(
    "/v1/users/favorites",
    { auth: "required", retry: 1 },
  )
}

export function getFollowers(username: string) {
  return http.get<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>>(
    `/v1/users/${seg(username)}/followers`,
    { auth: "required", retry: 1 },
  )
}

export function getFollowing(username: string) {
  return http.get<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>>(
    `/v1/users/${seg(username)}/following`,
    { auth: "required", retry: 1 },
  )
}

export function followUser(username: string) {
  return http.post<void>(`/v1/users/${seg(username)}/follow`, undefined, { auth: "required" })
}

export function unfollowUser(username: string) {
  return http.delete<void>(`/v1/users/${seg(username)}/follow`, { auth: "required", responseType: "void" })
}

export function isFavorite(username: string) {
  return http.get<{ favorited: boolean; count?: number }>(`/v1/users/${seg(username)}/favorite`, {
    auth: "required",
    retry: 1,
  })
}

export function addFavorite(username: string) {
  return http.post<{ favorited: boolean; count?: number }>(`/v1/users/${seg(username)}/favorite`, undefined, {
    auth: "required",
  })
}

export function removeFavorite(username: string) {
  return http.delete<{ favorited: boolean; count?: number }>(`/v1/users/${seg(username)}/favorite`, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// Showcase
// ------------------------------------------------------------------

export type ShowcaseItem = {
  id: string
  caption?: string
  imageUrl?: string
  fileKey?: string
  createdAt: string
  sortOrder?: number
}

export function getMyShowcase() {
  return http.get<ShowcaseItem[]>("/v1/users/me/showcase", { auth: "required", retry: 1 })
}

export function uploadShowcase(formData: FormData) {
  return http.post<ShowcaseItem, FormData>("/v1/users/me/showcase/upload", formData, { auth: "required" })
}

export function createShowcase(item: Partial<ShowcaseItem>) {
  return http.post<ShowcaseItem, Partial<ShowcaseItem>>("/v1/users/me/showcase", item, { auth: "required" })
}

export function updateShowcase(id: string, item: Partial<ShowcaseItem>) {
  return http.put<ShowcaseItem, Partial<ShowcaseItem>>(`/v1/users/me/showcase/${seg(id)}`, item, {
    auth: "required",
  })
}

export function deleteShowcase(id: string) {
  return http.delete<void>(`/v1/users/me/showcase/${seg(id)}`, { auth: "required", responseType: "void" })
}

export function getPublicShowcase(username: string) {
  return http.get<ShowcaseItem[]>(`/v1/users/${seg(username)}/showcase`, { auth: "required", retry: 1 })
}

// ------------------------------------------------------------------
// Questions & answers
// ------------------------------------------------------------------

export type QuestionItem = {
  id: string
  question: string
  answer?: string | null
  answeredAt?: string | null
  createdAt: string
  asker?: { id: string; username: string; fullName?: string; avatarUrl?: string | null }
}

export function getMyQuestions() {
  return http.get<QuestionItem[]>("/v1/users/me/questions", { auth: "required", retry: 1 })
}

export function addQuestion(username: string, question: string) {
  return http.post<QuestionItem, { question: string }>(`/v1/users/${seg(username)}/questions`, { question }, {
    auth: "required",
  })
}

export function getPublicQuestions(username: string) {
  return http.get<QuestionItem[]>(`/v1/users/${seg(username)}/questions`, { auth: "required", retry: 1 })
}

export function answerQuestion(questionId: string, answer: string) {
  return http.put<QuestionItem, { answer: string }>(`/v1/users/questions/${seg(questionId)}/answer`, { answer }, {
    auth: "required",
  })
}

export function deleteQuestion(questionId: string) {
  return http.delete<void>(`/v1/users/questions/${seg(questionId)}`, { auth: "required", responseType: "void" })
}

export function getQuestionComments(questionId: string) {
  return http.get<Array<{ id: string; content: string; authorName?: string; createdAt: string; reply?: boolean }>>(
    `/v1/users/questions/${seg(questionId)}/comments`,
    { auth: "required", retry: 1 },
  )
}

export function addQuestionComment(questionId: string, content: string) {
  return http.post<{ id: string; content: string; createdAt: string }, { content: string }>(
    `/v1/users/questions/${seg(questionId)}/comments`,
    { content },
    { auth: "required" },
  )
}

export function deleteQuestionComment(commentId: string) {
  return http.delete<void>(`/v1/users/comments/${seg(commentId)}`, { auth: "required", responseType: "void" })
}
