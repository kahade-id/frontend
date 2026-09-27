/**
 * Kahade — domain `settings` (blocked users, report, privacy, language).
 * Profil/2FA/PIN tetap di users.ts & auth.ts & wallet.ts.
 */

import { readList } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"
import { ApiError, isApiError } from "@/lib/api/errors"
import type { ReportUserSettingsDto, UpdateLanguageDto, UpdatePrivacyDto } from "@/lib/api/types"

export type BlockedUser = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
  blockedAt: string
}

export type ReportsSettings = {
  id: string
  targetId: string
  category: string
  status: string
  createdAt: string
}

/**
 * GAP-B1 (G076–G083): pengaturan privasi granular — mirror kontrak backend
 * `PUT /v1/settings/privacy`. Semua field granular opsional (PATCH semantics):
 * server boleh mengirim subset; UI tidak boleh mengarang default.
 */
export type PrivacyListVisibility = "EVERYONE" | "FOLLOWERS" | "ONLY_ME"
export type QaCommentPolicy = "EVERYONE" | "FOLLOWERS" | "DISABLED"
export type PrivacySettings = {
  profileVisible: boolean
  showOnlineStatus: boolean
  /** G076: visibilitas field identitas akun (viewer != owner). */
  showEmail?: boolean
  showPhone?: boolean
  showDob?: boolean
  showGender?: boolean
  /** G077: siapa yang dapat melihat daftar follower/following. */
  showFollowerList?: PrivacyListVisibility
  showFollowingList?: PrivacyListVisibility
  /** G078: visibilitas default etalase baru. */
  showcaseDefaultVisibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS"
  /** G079–G080: kebijakan Q&A profil. */
  qaCommentPolicy?: QaCommentPolicy
  qaAnswerModeration?: boolean
  /** G081–G082: ulasan & statistik. */
  showReviews?: boolean
  hiddenStats?: string[]
  /** G083: indeks mesin pencari. */
  searchEngineIndex?: boolean
}

function normalizeBlockedUser(value: unknown): BlockedUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = row.userId ?? row.id
  if (typeof id !== "string" || typeof row.username !== "string") return null
  return {
    id,
    username: row.username,
    fullName: typeof row.fullName === "string" ? row.fullName : undefined,
    avatarUrl: typeof row.avatarUrl === "string" || row.avatarUrl === null ? row.avatarUrl : undefined,
    blockedAt: typeof row.blockedAt === "string" ? row.blockedAt : "",
  }
}

/** Canonical mobile list: flattened users whose `userId` is valid for unblock. */
export function getBlockedUsers(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/users/me/blocked", { auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<unknown>(raw, ["blockedUsers", "users"])
        .map(normalizeBlockedUser)
        .filter((row): row is BlockedUser => row !== null),
    )
}

/**
 * Jalankan aksi blokir/lapor yang tersedia DI DUA modul backend dengan
 * resolusi identifier BERBEDA:
 *
 *   - Modul users   `POST/DELETE /v1/users/{userId}/block`, `POST /v1/users/{userId}/report`
 *     → service mencari `user.userId` (format `USR-XXXX`, satu-satunya id
 *     yang diumumkan profil publik).
 *   - Modul settings `POST/DELETE /v1/settings/block/{userId}`, `POST /v1/settings/report`
 *     → service mencari `user.id` (CUID internal — tidak pernah ada di
 *     profil publik).
 *
 * Cacat yang dilaporkan pengguna: profil publik mengirim `USR-XXXX`, adapter
 * lama HANYA memanggil modul settings → 404 "User not found" → fallback
 * username → 400 "Invalid ID format" / "targetId must be a valid ID".
 *
 * Urutan yang dipakai per identifier kandidat:
 *   1. route modul users (menerima USR-XXXX — yang umum dimiliki UI),
 *   2. route modul settings (menerima CUID — yang dimiliki list blokir lama),
 *   lalu identifier cadangan (username) dengan urutan yang sama.
 *
 * Aturan aman:
 *   - `primary` kosong → langsung pakai `fallback` (jangan pernah mengirim `""`).
 *   - Ulang hanya pada 404 / NOT_FOUND / BAD_REQUEST: pada status itu backend
 *     TIDAK membuat apa pun, jadi tidak ada risiko duplikasi (penting untuk
 *     laporan).
 *   - Semua kandidat gagal → lempar error terakhir apa adanya.
 */
async function withUserIdentity<T>(
  primary: string | undefined,
  fallback: string | undefined,
  call: (identifier: string, route: "users" | "settings") => Promise<T>,
): Promise<T> {
  const candidates = [primary?.trim(), fallback?.trim()].filter(
    (value): value is string => Boolean(value),
  )
  const unique = [...new Set(candidates)]
  if (unique.length === 0)
    throw new ApiError({
      code: "VALIDATION",
      message: "Identitas pengguna tujuan tidak tersedia. Muat ulang halaman lalu coba lagi.",
    })
  let lastError: unknown
  for (const identifier of unique) {
    for (const route of ["users", "settings"] as const) {
      try {
        return await call(identifier, route)
      } catch (error) {
        lastError = error
        const retryable =
          isApiError(error) &&
          (error.status === 404 || error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
        if (!retryable) throw error
      }
    }
  }
  throw lastError
}

export function blockUser(userId: string, fallbackUsername?: string) {
  return withUserIdentity(userId, fallbackUsername, (identifier, route) =>
    route === "users"
      ? http.post<{ message: string }>(`/v1/users/${seg(identifier)}/block`, undefined, {
          auth: "required",
        })
      : http.post<{ message: string }>(`/v1/settings/block/${seg(identifier)}`, undefined, {
          auth: "required",
        }),
  )
}

export function unblockUser(userId: string, fallbackUsername?: string) {
  return withUserIdentity(userId, fallbackUsername, (identifier, route) =>
    route === "users"
      ? http.delete<{ message: string }>(`/v1/users/${seg(identifier)}/block`, {
          auth: "required",
        })
      : http.delete<{ message: string }>(`/v1/settings/block/${seg(identifier)}`, {
          auth: "required",
        }),
  )
}

export function reportUser(dto: ReportUserSettingsDto, fallbackUsername?: string) {
  // Kembalikan `unknown`: bentuk respons kedua route berbeda dan caller
  // (app/reports.tsx) tidak memakai return value.
  return withUserIdentity<unknown>(dto.targetId, fallbackUsername, (identifier, route) =>
    route === "users"
      ? http.post<
          { message: string },
          {
            category: ReportUserSettingsDto["category"]
            description: string
            evidenceUrls?: string[]
            relatedOrderId?: string
          }
        >(
          `/v1/users/${seg(identifier)}/report`,
          {
            category: dto.category,
            description: dto.description,
            // Modul users tidak mengenal relatedMessageId — jangan kirim
            // (forbidNonWhitelisted → 400).
            evidenceUrls: dto.evidenceUrls,
            relatedOrderId: dto.relatedOrderId,
          },
          { auth: "required" },
        )
      : http.post<ReportsSettings, ReportUserSettingsDto>(
          "/v1/settings/report",
          { ...dto, targetId: identifier },
          { auth: "required" },
        ),
  )
}

export function getReports(signal?: AbortSignal) {
  return http
    .get<ReportsSettings[]>("/v1/settings/reports", { auth: "required", signal })
    .then((raw) => readList<ReportsSettings>(raw, ["reports"]))
}

export function getPrivacySettings(signal?: AbortSignal) {
  return http.get<PrivacySettings>("/v1/settings/privacy", { auth: "required", retry: 1, signal })
}

export function updatePrivacySettings(dto: UpdatePrivacyDto) {
  return http.put<PrivacySettings, UpdatePrivacyDto>("/v1/settings/privacy", dto, {
    auth: "required",
  })
}

/**
 * GAP-B1 (G084–G086): persetujuan (consent) per jenis.
 * GET /v1/settings/consents — status saat ini per jenis.
 * PUT /v1/settings/consents — beri/tarik persetujuan. TRANSACTIONAL tidak
 * dapat ditarik (revocable=false; server menolak dengan 400).
 */
export type ConsentType = "MARKETING_PUSH" | "MARKETING_EMAIL" | "MARKETING_WHATSAPP" | "TRANSACTIONAL"

export type ConsentStatus = {
  type: ConsentType
  granted: boolean
  revocable: boolean
  policyVersion: string
  policyTextHash: string | null
  title: { id: string; en: string }
  grantedAt: string | null
  revokedAt: string | null
  channel: string | null
}

export function getConsents(signal?: AbortSignal) {
  return http.get<ConsentStatus[]>("/v1/settings/consents", { auth: "required", signal })
}

export function updateConsent(type: ConsentType, granted: boolean) {
  return http.put<ConsentStatus, { type: ConsentType; granted: boolean; channel: string }>(
    "/v1/settings/consents",
    { type, granted, channel: "in-app" },
    { auth: "required" },
  )
}

export type ConsentHistoryEntry = {
  type: ConsentType
  granted: boolean
  policyVersion: string
  channel: string | null
  ipAddress: string | null
  createdAt: string
}

/** GET /v1/settings/consents/history — riwayat persetujuan berversi. */
export function getConsentHistory(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/settings/consents/history", { auth: "required", signal })
    .then((raw) => readList<ConsentHistoryEntry>(raw, ["items", "data"]))
}

export function getLanguage(signal?: AbortSignal) {
  return http.get<{ language: "id" | "en" }>("/v1/settings/language", {
    auth: "required",
    signal,
  })
}

export function updateLanguage(dto: UpdateLanguageDto) {
  return http.put<{ language: "id" | "en" }, UpdateLanguageDto>("/v1/settings/language", dto, {
    auth: "required",
  })
}

/**
 * GAP-B1 (G087–G100): ekspor data pribadi.
 *
 * POST /v1/settings/privacy/export — membuat arsip secara sinkron dan
 * mengembalikan URL unduh bertanda waktu. Cooldown 24 jam antar permintaan
 * (429/400 bila terlalu sering).
 */
export type DataExportResult = {
  message: string
  downloadUrl: string
  expiresAt: string
  requestId: string
}

export function exportPrivacy(format: "json" | "csv" = "json") {
  return http.post<DataExportResult, { format: "json" | "csv" }>(
    "/v1/settings/privacy/export",
    { format },
    { auth: "required" },
  )
}

export type ExportRequestSummary = {
  id: string
  status: "PENDING" | "READY" | "EXPIRED" | "FAILED"
  format: "JSON" | "CSV"
  requestedAt: string
  readyAt: string | null
  expiresAt: string | null
  downloadedAt: string | null
  downloadCount: number
}

/** GET /v1/settings/exports — riwayat permintaan ekspor (status + kedaluwarsa). */
export function getExportHistory(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/settings/exports", { auth: "required", signal })
    .then((raw) => readList<ExportRequestSummary>(raw, ["items", "data"]))
}

/** GET /v1/settings/exports/:id/download — URL signed baru (5 menit), tercatat di audit. */
export function downloadExportRequest(id: string) {
  return http.get<{ downloadUrl: string; expiresAt: string }>(
    `/v1/settings/exports/${id}/download`,
    { auth: "required" },
  )
}
