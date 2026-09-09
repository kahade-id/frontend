import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `settings` (blocked users, report, privacy, language).
 * Profil/2FA/PIN tetap di users.ts & auth.ts & wallet.ts.
 */
import { http, seg } from "@/lib/api/client"
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

export type PrivacySettings = {
  profileVisible: boolean
  showOnlineStatus: boolean
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

export function blockUser(userId: string) {
  return http.post<BlockedUser>(`/v1/settings/block/${seg(userId)}`, undefined, {
    auth: "required",
  })
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
