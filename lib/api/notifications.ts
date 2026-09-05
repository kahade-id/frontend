/**
 * Kahade — domain `notifications` (tag "notifications" di kahade-api-mobile.json).
 *
 * Endpoint yang tersedia:
 *   GET  /v1/notifications/unread-count      — badge jumlah unread
 *   GET  /v1/notifications                  — list notifikasi (filter kategori + paginasi)
 *   POST /v1/notifications/:id/read         — tandai satu notif dibaca
 *   POST /v1/notifications/read-all         — tandai semua dibaca
 *   POST /v1/notifications/register-device  — daftarkan perangkat push
 *   POST /v1/notifications/unregister-device — cabut perangkat push
 *
 * Semua endpoint `security: access-token` → `auth: "required"`.
 *
 * Keputusan non-obvious:
 *   - `category` pada `getUnreadCount` dibuat OPSIONAL (lihat komentar asal).
 *   - Tipe `Notification` menggunakan nama `AppNotification` untuk menghindari
 *     konflik dengan Web API bawaan `Notification`.
 */
import { http, seg } from "@/lib/api/client"
import type { BatchNotificationIdsDto, RegisterDeviceDto, UpdatePreferencesDto } from "@/lib/api/types"

// ------------------------------------------------------------------
// Tipe
// ------------------------------------------------------------------

/** Enum kategori — persis `GET /v1/notifications` query `category`. */
export type NotificationCategory = "TRANSAKSI" | "PROMOSI" | "INFORMASI"

/** Response `GET /v1/notifications/unread-count` — UNVERIFIED (spec tanpa schema). */
export type UnreadCountResult =
  | number
  | {
      count?: number
      unreadCount?: number
      unread?: number
      data?: { count?: number; unreadCount?: number; unread?: number }
    }

/** Satu entri notifikasi — UNVERIFIED. */
export type AppNotification = {
  id: string
  title: string
  body: string
  category: NotificationCategory
  isRead: boolean
  createdAt: string
  /** Deep-link atau referensi entitas terkait (opsional). */
  referenceId?: string | null
  referenceType?: string | null
}

export type NotificationListResponse = {
  data: AppNotification[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

// ------------------------------------------------------------------
// Endpoint
// ------------------------------------------------------------------

/**
 * GET /v1/notifications/unread-count
 * Tanpa `category` = total semua kategori (asumsi — lihat komentar asal).
 */
export function getUnreadCount(category?: NotificationCategory) {
  return http.get<UnreadCountResult>("/v1/notifications/unread-count", {
    query: { category },
    auth: "required",
    retry: 1,
  })
}

/** Normalisasi body unread-count → angka ≥ 0, atau `null` bila bentuknya tak dikenal. */
export function readUnreadCount(body: UnreadCountResult | undefined | null): number | null {
  if (typeof body === "number") return clamp(body)
  if (typeof body !== "object" || body === null) return null
  const candidates = [
    body.count,
    body.unreadCount,
    body.unread,
    body.data?.count,
    body.data?.unreadCount,
    body.data?.unread,
  ]
  const found = candidates.find((v): v is number => typeof v === "number" && Number.isFinite(v))
  return found === undefined ? null : clamp(found)
}

function clamp(n: number): number {
  return Math.max(0, Math.trunc(n))
}

/**
 * GET /v1/notifications — list notifikasi user.
 * `category` opsional — tanpa filter = semua kategori.
 */
export function getNotifications(query: {
  category?: NotificationCategory
  page?: number
  limit?: number
} = {}) {
  return http.get<NotificationListResponse>("/v1/notifications", {
    query,
    auth: "required",
    retry: 1,
  })
}

/** POST /v1/notifications/:id/read — tandai satu notifikasi dibaca. */
export function markNotificationRead(id: string) {
  return http.post<void>(`/v1/notifications/${seg(id)}/read`, undefined, { auth: "required" })
}

/** POST /v1/notifications/read-all — tandai semua notifikasi dibaca. */
export function markAllNotificationsRead() {
  return http.post<void>("/v1/notifications/read-all", undefined, { auth: "required" })
}

/** POST /v1/notifications/register-device — daftarkan perangkat push. */
export function registerDevice(dto: RegisterDeviceDto) {
  return http.post<void, RegisterDeviceDto>("/v1/notifications/register-device", dto, {
    auth: "required",
  })
}

/** POST /v1/notifications/unregister-device — cabut pendaftaran perangkat push. */
export function unregisterDevice() {
  return http.post<void>("/v1/notifications/unregister-device", undefined, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// Preferensi & batch (untuk layar Pengaturan, audit #15)
// ------------------------------------------------------------------

/** Response GET /v1/notifications/preferences. */
export type NotificationPreferences = {
  orderInApp?: boolean
  orderPush?: boolean
  orderEmail?: boolean
  walletInApp?: boolean
  walletPush?: boolean
  walletEmail?: boolean
  securityInApp?: boolean
  securityPush?: boolean
  securityEmail?: boolean
  chatInApp?: boolean
  chatPush?: boolean
  disputeInApp?: boolean
  disputePush?: boolean
  disputeEmail?: boolean
  rankingInApp?: boolean
  rankingPush?: boolean
  marketingEmail?: boolean
}

export type NotificationPreferenceKey = keyof NotificationPreferences

export function getNotificationPreferences() {
  return http.get<NotificationPreferences>("/v1/notifications/preferences", {
    auth: "required",
    retry: 1,
  })
}

export function updateNotificationPreferences(dto: UpdatePreferencesDto) {
  return http.put<NotificationPreferences, UpdatePreferencesDto>(
    "/v1/notifications/preferences",
    dto,
    { auth: "required" },
  )
}

export function markNotificationsReadBatch(notifIds: string[]) {
  return http.post<void, BatchNotificationIdsDto>("/v1/notifications/read-batch", { notifIds }, {
    auth: "required",
  })
}

export function deleteNotificationsBatch(notifIds: string[]) {
  return http.post<void, BatchNotificationIdsDto>("/v1/notifications/delete-batch", { notifIds }, {
    auth: "required",
  })
}

export function deleteReadNotifications() {
  return http.post<void>("/v1/notifications/delete-read", undefined, { auth: "required" })
}

export function getNotification(id: string) {
  return http.get<AppNotification>(`/v1/notifications/${seg(id)}`, { auth: "required", retry: 1 })
}

export function deleteNotification(id: string) {
  return http.delete<void>(`/v1/notifications/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}
