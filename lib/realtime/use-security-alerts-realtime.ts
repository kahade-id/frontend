import { useCallback, useEffect, useState } from "react"

import { SECURITY_SOCKET_EVENTS } from "@/lib/realtime/chat-events"
import { useRealtime } from "@/lib/realtime/realtime-context"

export type NewDeviceLoginPayload = {
  deviceInfo?: string
  ipAddress?: string
  timestamp?: string
}

/**
 * SYS-C-403: dengarkan event WS `new.device.login` dan simpan payload-nya
 * untuk ditampilkan sebagai dialog peringatan keamanan.
 *
 * Event di-emit backend (`auth.service.ts:4235`) ke room `user:<id>` setiap
 * kali akun diakses dari perangkat baru — sebelumnya 0 listener di FE,
 * sehingga peringatan keamanan kritis ini tidak pernah sampai ke UI secara
 * realtime (hanya lewat inbox). Pola sama dengan `useNotificationsRealtime`
 * (BFI-112): event di-verifikasi via `unwrapEvent` (envelope HMAC), event
 * tak-valid diabaikan diam-diam.
 *
 * Hook ini murni state (tanpa JSX) — komponen global
 * `<RealtimeGlobalListeners>` me-render dialognya.
 */
export function useNewDeviceLoginAlert() {
  const { socket, unwrapEvent } = useRealtime()
  const [alert, setAlert] = useState<NewDeviceLoginPayload | null>(null)

  useEffect(() => {
    if (!socket) return
    const onNewDeviceLogin = (raw: unknown) => {
      const payload = unwrapEvent(raw)
      if (payload === null) return
      // Defensif: tampilkan hanya field string non-kosong; payload
      // malformed tetap memicu dialog generik (peringatan lebih penting
      // daripada detailnya).
      setAlert({
        deviceInfo: typeof payload.deviceInfo === "string" && payload.deviceInfo ? payload.deviceInfo : undefined,
        ipAddress: typeof payload.ipAddress === "string" && payload.ipAddress ? payload.ipAddress : undefined,
        timestamp: typeof payload.timestamp === "string" && payload.timestamp ? payload.timestamp : undefined,
      })
    }
    socket.on(SECURITY_SOCKET_EVENTS.NEW_DEVICE_LOGIN, onNewDeviceLogin)
    return () => {
      socket.off(SECURITY_SOCKET_EVENTS.NEW_DEVICE_LOGIN, onNewDeviceLogin)
    }
  }, [socket, unwrapEvent])

  const dismiss = useCallback(() => setAlert(null), [])
  return { alert, dismiss }
}
