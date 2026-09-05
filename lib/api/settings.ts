/**
 * Kahade — domain `settings` (blocked users, report, privacy, language).
 * Profil/2FA/PIN tetap di users.ts & auth.ts & wallet.ts.
 */
import { http, seg } from "@/lib/api/client"
import type {
  ReportUserSettingsDto,
  UpdateLanguageDto,
  UpdatePrivacyDto,
} from "@/lib/api/types"

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

export type PrivacySettings = {
  profileVisible: boolean
  showOnlineStatus: boolean
}

/** GET /v1/settings/blocked-users (juga GET /v1/users/me/blocked). */
export function getBlockedUsers() {
  return http.get<BlockedUser[]>("/v1/settings/blocked-users", { auth: "required", retry: 1 })
}

export function blockUser(userId: string) {
  return http.post<BlockedUser>(`/v1/settings/block/${seg(userId)}`, undefined, { auth: "required" })
}

export function unblockUser(userId: string) {
  return http.delete<void>(`/v1/settings/block/${seg(userId)}`, {
    auth: "required",
    responseType: "void",
  })
}

export function reportUser(dto: ReportUserSettingsDto) {
  return http.post<ReportsSettings, ReportUserSettingsDto>("/v1/settings/report", dto, {
    auth: "required",
  })
}

export function getReports() {
  return http.get<ReportsSettings[]>("/v1/settings/reports", { auth: "required", retry: 1 })
}

export function getPrivacySettings() {
  return http.get<PrivacySettings>("/v1/settings/privacy", { auth: "required", retry: 1 })
}

export function updatePrivacySettings(dto: UpdatePrivacyDto) {
  return http.put<PrivacySettings, UpdatePrivacyDto>("/v1/settings/privacy", dto, { auth: "required" })
}

export function getLanguage() {
  return http.get<{ language: "id" | "en" }>("/v1/settings/language", { auth: "required", retry: 1 })
}

export function updateLanguage(dto: UpdateLanguageDto) {
  return http.put<{ language: "id" | "en" }, UpdateLanguageDto>("/v1/settings/language", dto, {
    auth: "required",
  })
}

/**
 * POST /v1/settings/privacy/export — minta ekspor data pribadi.
 * Spec hanya `201: ""` (UNVERIFIED): backend bisa mengembalikan `{ url }`
 * (tautan unduh siap) atau pesan bahwa ekspor diproses & dikirim via email.
 * Keduanya opsional di tipe supaya UI bisa memilih perilaku.
 */
export function exportPrivacy() {
  return http.post<{ url?: string; message?: string } | undefined, undefined>(
    "/v1/settings/privacy/export",
    undefined,
    { auth: "required" },
  )
}
