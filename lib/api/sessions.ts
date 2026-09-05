/**
 * Kahade — domain `sessions` (perangkat login aktif + security/activity log).
 * Perangkat juga tersedia via users.me.devices; sessions adalah sumber utama
 * untuk layar "Keamanan > Perangkat".
 */
import { http, seg } from "@/lib/api/client"
import type { TrustDeviceDto } from "@/lib/api/types"

export type DeviceSession = {
  id: string
  deviceName: string
  platform?: string
  browser?: string
  ip?: string
  location?: string
  current?: boolean
  trusted?: boolean
  lastActiveAt?: string
  createdAt: string
}

/** Query paginasi — spec menandai `page` & `limit` REQUIRED di semua list di domain ini. */
export type SessionsPageQuery = { page: number; limit: number }

/** GET /v1/sessions — daftar sesi login aktif (paginated; page/limit wajib). */
export function listSessions(query: SessionsPageQuery) {
  return http.get<DeviceSession[]>("/v1/sessions", { query, auth: "required", retry: 1 })
}

export function deleteSession(sessionId: string) {
  return http.delete<void>(`/v1/sessions/${seg(sessionId)}`, {
    auth: "required",
    responseType: "void",
  })
}

export function deleteOtherSessions() {
  return http.delete<void>("/v1/sessions/others", { auth: "required", responseType: "void" })
}

/**
 * PATCH /v1/users/me/devices/{deviceId}/trust — tandai perangkat tepercaya
 * (lewati 2FA saat login). Spec: method PATCH dengan body `TrustDeviceDto`
 * (objek kosong — dikirim `{}` agar `Content-Type: application/json` valid).
 */
export function trustDevice(deviceId: string, dto: TrustDeviceDto = {}) {
  return http.patch<DeviceSession, TrustDeviceDto>(`/v1/users/me/devices/${seg(deviceId)}/trust`, dto, {
    auth: "required",
  })
}

/** PATCH /v1/users/me/devices/{deviceId}/untrust. */
export function untrustDevice(deviceId: string) {
  return http.patch<DeviceSession>(`/v1/users/me/devices/${seg(deviceId)}/untrust`, undefined, {
    auth: "required",
  })
}

export type SecurityLogEntry = { id: string; action: string; ip?: string; createdAt: string }
export type ActivityLogEntry = { id: string; action: string; description?: string; createdAt: string }

/**
 * Filter `action` — spec menandainya REQUIRED tanpa enum/deskripsi. Nilai
 * "ALL" adalah asumsi terdokumentasi (sama seperti `type` di wallet
 * transactions); satu tempat untuk dikoreksi bila backend memakai nilai lain.
 */
export const SECURITY_LOG_ALL_ACTIONS = "ALL"

/** GET /v1/users/me/security-log — aktivitas keamanan (page/limit/action wajib). */
export function getSecurityLog(query: SessionsPageQuery & { action?: string }) {
  return http.get<SecurityLogEntry[]>("/v1/users/me/security-log", {
    query: { action: SECURITY_LOG_ALL_ACTIONS, ...query },
    auth: "required",
    retry: 1,
  })
}

/** GET /v1/users/me/activity-log — aktivitas umum (page/limit wajib). */
export function getActivityLog(query: SessionsPageQuery) {
  return http.get<ActivityLogEntry[]>("/v1/users/me/activity-log", { query, auth: "required", retry: 1 })
}
