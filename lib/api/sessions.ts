import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `sessions` (perangkat login aktif + security/activity log).
 * Perangkat juga tersedia via users.me.devices; sessions adalah sumber utama
 * untuk layar "Keamanan > Perangkat".
 */
import { http, seg } from "@/lib/api/client"
import type { TrustDeviceDto } from "@/lib/api/types"

export type DeviceSession = {
  /** userSession.id — valid only for /v1/sessions/{sessionId}. */
  id: string
  /** users/me/devices/{deviceId} — used only for trust/untrust operations. */
  deviceId?: string
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

/** Normalize the actual SessionsService response; never invent a device ID/trust state. */
export function normalizeSession(value: unknown): DeviceSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || !row.id) return null
  const device = row.device && typeof row.device === "object" ? (row.device as Record<string, unknown>) : undefined
  const deviceInfo = typeof row.deviceInfo === "string" ? row.deviceInfo : undefined
  return {
    id: row.id,
    /**
     * `PATCH /v1/users/me/devices/{deviceId}/trust` butuh id PERANGKAT, yang
     * berbeda dari `userSession.id`. Spec tidak mendokumentasikan bentuk respons
     * `GET /v1/sessions`, jadi bila backend menaruhnya di tempat lain toggle
     * "Perangkat tepercaya" buntu dengan "Status perangkat belum tersedia".
     * Karena itu beberapa alias dicoba, bukan hanya `deviceId`.
     */
    deviceId:
      typeof row.deviceId === "string"
        ? row.deviceId
        : typeof device?.id === "string"
          ? device.id
          : typeof device?.deviceId === "string"
            ? device.deviceId
            : typeof row.userDeviceId === "string"
              ? row.userDeviceId
              : undefined,
    deviceName:
      (typeof row.deviceName === "string" && row.deviceName) || deviceInfo || "Perangkat tidak dikenal",
    platform: typeof row.platform === "string" ? row.platform : undefined,
    browser: typeof row.browser === "string" ? row.browser : undefined,
    ip:
      typeof row.ipAddress === "string"
        ? row.ipAddress
        : typeof row.ip === "string"
          ? row.ip
          : undefined,
    location: typeof row.location === "string" ? row.location : undefined,
    current: row.isCurrentSession === true || row.current === true,
    trusted:
      typeof row.trusted === "boolean"
        ? row.trusted
        : typeof row.isTrusted === "boolean"
          ? row.isTrusted
          : undefined,
    lastActiveAt: typeof row.lastActiveAt === "string" ? row.lastActiveAt : undefined,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
  }
}

/** Query paginasi — spec menandai `page` & `limit` REQUIRED di semua list di domain ini. */
export type SessionsPageQuery = { page: number; limit: number }

/** GET /v1/sessions — daftar sesi login aktif (paginated; page/limit wajib). */
export function listSessions(query: SessionsPageQuery, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/sessions", { query, auth: "required", retry: 1, signal })
    .then((raw) => readList<unknown>(raw, ["sessions"]).map(normalizeSession).filter((row): row is DeviceSession => row !== null))
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
export function trustDevice(deviceId: string, dto: TrustDeviceDto) {
  return http.patch<DeviceSession, TrustDeviceDto>(
    `/v1/users/me/devices/${seg(deviceId)}/trust`,
    dto,
    {
      auth: "required",
    },
  )
}

/** PATCH /v1/users/me/devices/{deviceId}/untrust. */
export function untrustDevice(deviceId: string, dto: TrustDeviceDto) {
  return http.patch<DeviceSession, TrustDeviceDto>(`/v1/users/me/devices/${seg(deviceId)}/untrust`, dto, {
    auth: "required",
  })
}

export type SecurityLogEntry = { id: string; action: string; ip?: string; createdAt: string }
export type ActivityLogEntry = {
  id: string
  action: string
  description?: string
  createdAt: string
}

/**
 * Filter `action` — spec menandainya REQUIRED tanpa enum/deskripsi. Nilai
 * "ALL" adalah asumsi terdokumentasi (sama seperti `type` di wallet
 * transactions); satu tempat untuk dikoreksi bila backend memakai nilai lain.
 */
export const SECURITY_LOG_ALL_ACTIONS = "ALL"

/** GET /v1/users/me/security-log — aktivitas keamanan (page/limit/action wajib). */
export function getSecurityLog(
  query: SessionsPageQuery & { action?: string },
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/users/me/security-log", {
      query: { action: SECURITY_LOG_ALL_ACTIONS, ...query },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readList<SecurityLogEntry>(raw, ["securityLog", "logs"]))
}

/** GET /v1/users/me/activity-log — aktivitas umum (page/limit wajib). */
export function getActivityLog(query: SessionsPageQuery, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/users/me/activity-log", {
      query,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readList<ActivityLogEntry>(raw, ["activityLog", "logs"]))
}
