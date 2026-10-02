/** Navigation shell: no network gate on the originating button. */
import { useEffect, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { ChatCircle, Package } from "phosphor-react-native"
import { api } from "@/lib/api"
import { getOrCreateDm, isDmNotAllowedError } from "@/lib/api/chat"
import { userMessage } from "@/lib/api/errors"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import { ROUTES } from "@/lib/routes"
import { DataScreen } from "@/components/ui/data-screen"
import { Button } from "@/components/ui/button"

export default function PrepareNavigationScreen() {
  const { kind, id, title } = useLocalSearchParams<{ kind: string; id: string; title?: string }>()
  const guestBlocked = useGuestPathBlocked()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ loading: boolean; error: string | null; empty?: string }>({ loading: true, error: null })
  const retry = () => setAttempt((value) => value + 1)

  useEffect(() => {
    if (guestBlocked) return
    let cancelled = false
    const controller = new AbortController()
    setState({ loading: true, error: null })
    void (async () => {
      try {
        if (!id || (kind !== "dm" && kind !== "tracking")) {
          setState({ loading: false, error: "Tujuan tidak tersedia." })
          return
        }
        if (kind === "dm") {
          // get-or-create is idempotent. Never send a message automatically.
          const room = await getOrCreateDm(id)
          if (!cancelled) router.replace(ROUTES.chatRoom(room.id, title ?? `@${id}`))
        } else {
          const shipment = await api.courier.getShipmentByOrder(id, controller.signal)
          if (cancelled) return
          if (shipment) router.replace(ROUTES.trackingDetail(shipment.id))
          else setState({ loading: false, error: null, empty: "Pengiriman ini memakai resi manual — belum ada timeline kurir terintegrasi." })
        }
      } catch (error) {
        if (cancelled) return
        if (kind === "dm" && isDmNotAllowedError(error)) {
          setState({ loading: false, error: null, empty: "Pengguna ini membatasi pesan langsung baru. Anda hanya bisa chat dengannya lewat transaksi." })
        } else setState({ loading: false, error: userMessage(error) })
      }
    })()
    // Back while pending must never redirect the user after they leave.
    return () => { cancelled = true; controller.abort() }
  }, [kind, id, title, attempt, guestBlocked])

  return (
    <DataScreen
      title={kind === "dm" ? "Kirim Pesan" : "Lacak Pengiriman"}
      loadingMessage={kind === "dm" ? "Menyiapkan percakapan…" : "Memuat pengiriman…"}
      state={{ ...state, refresh: retry, reload: retry }}
      empty={state.empty ? {
        icon: kind === "dm" ? ChatCircle : Package,
        title: kind === "dm" ? "Tidak bisa mengirim pesan" : "Belum ada data pelacakan",
        description: state.empty,
        action: <Button onPress={() => router.back()}>Kembali</Button>,
      } : null}
    >{null}</DataScreen>
  )
}
