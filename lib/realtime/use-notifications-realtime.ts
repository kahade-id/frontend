import { useEffect } from "react"

import {
  NOTIFICATION_SOCKET_EVENTS,
  type NotificationUnreadCountPayload,
} from "@/lib/realtime/chat-events"
import { useRealtime } from "@/lib/realtime/realtime-context"
import { logWarn } from "@/lib/telemetry"
import { refreshUnreadCount, setUnreadCount } from "@/lib/unread-count"
import { invalidateQueryPrefix } from "@/lib/use-api-query"

/**
 * BFI-112: dengarkan event WS `notification.new` / `notification.unread_count`.
 *
 * Audit Notifikasi 2026-10-10 (FE-01/FE-22):
 *   - `notification.unread_count` membawa `{ unreadCount }` yang sudah
 *     dihitung server (semua kategori, preferensi in-app diterapkan) —
 *     diterapkan LANGSUNG ke store badge (`setUnreadCount`). Dulu event ini
 *     hanya membatalkan cache daftar; badge tab tetap menunggu poll 60 dtk.
 *   - `notification.new` → batalkan cache daftar + segarkan badge.
 *   - Hook ini kini dipasang SEKALI secara global
 *     (components/realtime-global-listeners.tsx), bukan per layar — badge
 *     bergerak walau tab Notifikasi tidak sedang terbuka.
 *
 * Event di-verifikasi via `unwrapEvent` (envelope HMAC); event tak-valid
 * diabaikan diam-diam. Defensif: bila socket mati, tidak ada yang terjadi
 * (jalur REST/push tetap jalan seperti sebelumnya).
 */
export function useNotificationsRealtime() {
  const { socket, unwrapEvent } = useRealtime()

  useEffect(() => {
    if (!socket) return
    const invalidateInbox = () => {
      try {
        invalidateQueryPrefix("notifications:")
      } catch (err) {
        logWarn("notifications:realtime-invalidate", err)
      }
    }
    const onNew = (raw: unknown) => {
      const payload = unwrapEvent(raw)
      if (payload === null) return
      invalidateInbox()
      void refreshUnreadCount()
    }
    const onUnreadCount = (raw: unknown) => {
      const payload = unwrapEvent(raw)
      if (payload === null) return
      const count = (payload as Partial<NotificationUnreadCountPayload>).unreadCount
      if (typeof count === "number" && Number.isFinite(count)) setUnreadCount(count)
      else void refreshUnreadCount()
      // Dipancarkan server setelah baca/hapus di perangkat lain → daftar
      // yang sedang terbuka di sini juga basi.
      invalidateInbox()
    }
    socket.on(NOTIFICATION_SOCKET_EVENTS.NEW, onNew)
    socket.on(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, onUnreadCount)
    return () => {
      socket.off(NOTIFICATION_SOCKET_EVENTS.NEW, onNew)
      socket.off(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, onUnreadCount)
    }
  }, [socket, unwrapEvent])
}
