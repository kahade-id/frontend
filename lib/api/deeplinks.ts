/**
 * Kahade — domain `deeplinks` (resolusi slug/username → route app).
 * Dipakai di app/_layout.tsx saat app dibuka dari link eksternal.
 */
import { http, seg } from "@/lib/api/client"

export type DeeplinkResolution = {
  kind: "user" | "profile" | "order-link" | "order" | "notification" | "showcase"
  id?: string
  username?: string
  orderId?: string
  notificationId?: string
  token?: string
  /** id item etalase (kind "showcase"). */
  showcaseId?: string
}

export function resolveUserDeeplink(username: string, signal?: AbortSignal) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/user/${seg(username)}`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

export function resolveProfileDeeplink(username: string, signal?: AbortSignal) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/profile/${seg(username)}`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

export function resolveOrderLinkDeeplink(token: string, signal?: AbortSignal) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/order-link/${seg(token)}`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

export function resolveOrderDeeplink(orderId: string, signal?: AbortSignal) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/order/${seg(orderId)}`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

/**
 * GET /v1/deeplinks/notification/{notificationId} — resolusi tautan notifikasi.
 */
export function resolveNotificationDeeplink(notificationId: string, signal?: AbortSignal) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/notification/${seg(notificationId)}`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

/**
 * GET /v1/deeplinks/showcase/{showcaseId} — resolusi tautan etalase.
 */
export function resolveShowcaseDeeplink(showcaseId: string, signal?: AbortSignal) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/showcase/${seg(showcaseId)}`, {
    auth: "none",
    retry: 1,
    signal,
  })
}
