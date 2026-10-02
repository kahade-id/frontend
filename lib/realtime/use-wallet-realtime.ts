import { useEffect } from "react"

import { WALLET_SOCKET_EVENTS } from "@/lib/realtime/chat-events"
import { useRealtime } from "@/lib/realtime/realtime-context"
import { queryKeys } from "@/lib/query-keys"
import { logWarn } from "@/lib/telemetry"
import { invalidateQueryPrefix } from "@/lib/use-api-query"

/**
 * SYS-C-403: dengarkan event WS `wallet.balance_updated` dan batalkan cache
 * saldo dompet agar angka ter-refresh secara realtime.
 *
 * Event di-emit backend ke room `user:<id>` (8 situs di
 * `wallet.service.ts`) — sebelumnya 0 listener di FE: saldo basi + traffic
 * WS sia-sia. Pola sama dengan `useNotificationsRealtime` (BFI-112):
 * event di-verifikasi via `unwrapEvent` (envelope HMAC), event tak-valid
 * diabaikan diam-diam; bila socket mati tidak ada yang terjadi (jalur REST
 * tetap jalan seperti sebelumnya).
 */
export function useWalletBalanceRealtime() {
  const { socket, unwrapEvent } = useRealtime()

  useEffect(() => {
    if (!socket) return
    const onBalanceUpdated = (raw: unknown) => {
      const payload = unwrapEvent(raw)
      if (payload === null) return
      try {
        // Kunci kanonis saldo = queryKeys.wallet() ("wallet"). Prefix juga
        // mencakup "wallet-limits" — ikut segar, tidak berbahaya.
        invalidateQueryPrefix(queryKeys.wallet())
      } catch (err) {
        logWarn("wallet:realtime-invalidate", err)
      }
    }
    socket.on(WALLET_SOCKET_EVENTS.BALANCE_UPDATED, onBalanceUpdated)
    return () => {
      socket.off(WALLET_SOCKET_EVENTS.BALANCE_UPDATED, onBalanceUpdated)
    }
  }, [socket, unwrapEvent])
}
