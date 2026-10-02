/** Navigation shell: no network gate on the originating button. */
import { useEffect, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { ChatCircle, Package } from "phosphor-react-native"
import { api } from "@/lib/api"
import {
  getOrCreateDm,
  isChatRoomForDmTarget,
  isDmNotAllowedError,
  isSameDmAccount,
} from "@/lib/api/chat"
import { userMessage } from "@/lib/api/errors"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import { ROUTES } from "@/lib/routes"
import { DataScreen } from "@/components/ui/data-screen"
import { Button } from "@/components/ui/button"

function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^@/, "").toLocaleLowerCase("en-US")
}

export default function PrepareNavigationScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>()
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
          // Resolve both accounts before creating/opening a room. A profile DM
          // is only safe when the authenticated viewer and requested recipient
          // are distinct and the returned room proves the same counterpart.
          const requestedUsername = id.replace(/^@/, "").trim()
          const [target, me] = await Promise.all([
            api.users.getUserByUsername(requestedUsername, controller.signal),
            api.users.getMeCached(controller.signal),
          ])
          if (cancelled) return

          const targetUsername = (target.username ?? requestedUsername).replace(/^@/, "").trim()
          const normalizedTarget = normalizeUsername(targetUsername)
          if (!normalizedTarget || normalizedTarget !== normalizeUsername(requestedUsername)) {
            setState({ loading: false, error: null, empty: "Profil tujuan tidak cocok. Percakapan tidak dibuka demi melindungi akun Anda." })
            return
          }
          const targetId = target.id?.trim() ?? ""
          const currentId = me.userId?.trim() || me.id?.trim() || ""
          if (
            isSameDmAccount(
              { id: targetId, username: targetUsername },
              { id: currentId, username: me.username },
            )
          ) {
            setState({ loading: false, error: null, empty: "Anda tidak dapat membuka pesan langsung dengan akun sendiri." })
            return
          }

          // get-or-create is idempotent. Never send a message automatically.
          const targetIdentity = { id: targetId || null, username: targetUsername }
          const room = await getOrCreateDm(targetUsername, controller.signal)
          if (cancelled) return
          let verifiedRoom = room
          if (!isChatRoomForDmTarget(verifiedRoom, targetIdentity)) {
            // POST may omit counterpart details. Verify the room resource before
            // deciding; never route using a room ID alone.
            verifiedRoom = await api.chat.getChatRoom(room.id, controller.signal)
          }
          if (cancelled) return
          if (!isChatRoomForDmTarget(verifiedRoom, targetIdentity)) {
            setState({
              loading: false,
              error: null,
              empty: "Percakapan tidak cocok dengan profil ini. Demi keamanan, percakapan tidak dibuka.",
            })
            return
          }
          router.replace(ROUTES.chatRoom(verifiedRoom.id))
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
  }, [kind, id, attempt, guestBlocked])

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
