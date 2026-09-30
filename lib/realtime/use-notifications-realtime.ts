import { useEffect } from "react"

import { NOTIFICATION_SOCKET_EVENTS } from "@/lib/realtime/chat-events"
import { useRealtime } from "@/lib/realtime/realtime-context"
import { logWarn } from "@/lib/telemetry"
import { invalidateQueryPrefix } from "@/lib/use-api-query"

/**
 * BFI-112: dengarkan event WS `notification.new` / `notification.unread_count`
 * dan batalkan cache inbox notifikasi agar daftar ter-refresh.
 *
 * Sebelum fix ini FE tidak punya listener sama sekali untuk kedua event —
 * tab Notifikasi hanya diperbarui saat pull-to-refresh / kembali fokus
 * (refreshOnFocus). Event di-verifikasi via `unwrapEvent` (envelope HMAC);
 * event tak-valid diabaikan diam-diam. Defensif: bila socket mati, tidak ada
 * yang terjadi (jalur REST/push tetap jalan seperti sebelumnya).
 */
export function useNotificationsRealtime() {
  const { socket, unwrapEvent } = useRealtime()

  useEffect(() => {
    if (!socket) return
    const onNotificationEvent = (raw: unknown) => {
      const payload = unwrapEvent(raw)
      if (payload === null) return
      try {
        invalidateQueryPrefix("notifications:")
      } catch (err) {
        logWarn("notifications:realtime-invalidate", err)
      }
    }
    socket.on(NOTIFICATION_SOCKET_EVENTS.NEW, onNotificationEvent)
    socket.on(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, onNotificationEvent)
    return () => {
      socket.off(NOTIFICATION_SOCKET_EVENTS.NEW, onNotificationEvent)
      socket.off(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, onNotificationEvent)
    }
  }, [socket, unwrapEvent])
}
