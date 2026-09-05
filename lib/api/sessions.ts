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

export function listSessions() {
  return http.get<DeviceSession[]>("/v1/sessions", { auth: "required", retry: 1 })
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

/** POST /v1/users/me/devices/{deviceId}/trust — trust perangkat. */
export function trustDevice(deviceId: string, dto: TrustDeviceDto = {}) {
  return http.post<DeviceSession, TrustDeviceDto>(`/v1/users/me/devices/${seg(deviceId)}/trust`, dto, {
    auth: "required",
  })
}

/** PATCH /v1/users/me/devices/{deviceId}/untrust. */
export function untrustDevice(deviceId: string) {
  return http.patch<DeviceSession>(`/v1/users/me/devices/${seg(deviceId)}/untrust`, undefined, {
    auth: "required",
  })
}

/** GET /v1/users/me/security-log — aktivitas keamanan. */
export function getSecurityLog(query?: { page?: number; limit?: number }) {
  return http.get<Array<{ id: string; action: string; ip?: string; createdAt: string }>>(
    "/v1/users/me/security-log",
    { query, auth: "required", retry: 1 },
  )
}

/** GET /v1/users/me/activity-log — aktivitas umum. */
export function getActivityLog(query?: { page?: number; limit?: number }) {
  return http.get<Array<{ id: string; action: string; description?: string; createdAt: string }>>(
    "/v1/users/me/activity-log",
    { query, auth: "required", retry: 1 },
  )
}
