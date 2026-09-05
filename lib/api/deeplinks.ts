/**
 * Kahade — domain `deeplinks` (resolusi slug/username → route app).
 * Dipakai di app/_layout.tsx saat app dibuka dari link eksternal.
 */
import { http, seg } from "@/lib/api/client"

export type DeeplinkResolution = {
  kind: "user" | "profile" | "order-link" | "order" | "notification"
  id?: string
  username?: string
  orderId?: string
  notificationId?: string
  token?: string
}

export function resolveUserDeeplink(username: string) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/user/${seg(username)}`, {
    auth: "none",
    retry: 1,
  })
}

export function resolveProfileDeeplink(username: string) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/profile/${seg(username)}`, {
    auth: "none",
    retry: 1,
  })
}

export function resolveOrderLinkDeeplink(token: string) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/order-link/${seg(token)}`, {
    auth: "none",
    retry: 1,
  })
}

export function resolveOrderDeeplink(orderId: string) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/order/${seg(orderId)}`, {
    auth: "none",
    retry: 1,
  })
}

export function resolveNotificationDeeplink(notificationId: string) {
  return http.get<DeeplinkResolution>(`/v1/deeplinks/notification/${seg(notificationId)}`, {
    auth: "none",
    retry: 1,
  })
}
