/**
 * Kahade — menu ⋮ ruang percakapan (lihat pesanan, cari pesan, profil lawan
 * bicara, bisukan, arsipkan).
 *
 * PUT /v1/chat/rooms/{roomId}  (mute / archived)
 *
 * Kenapa dipisah dari layar ruang chat (G-11: layar itu hanya boleh menyusut):
 * menu ini punya mutasi ruangnya sendiri (bisukan/arsip) beserta state sibuk
 * dan toast-nya. Layar hanya menyerahkan `room` dan menerima `onRoomChange`
 * untuk menambal header (badge bisu/senyap ikut berubah).
 *
 * Keputusan non-obvious:
 *   - Item bersyarat (lihat pesanan hanya bila ruang terkait order; profil
 *     hanya bila username lawan bicara ada) — menu tanpa item mati lebih
 *     pendek dan tidak menjanjikan aksi yang pasti gagal.
 *   - Bisukan/arsip memakai nilai TERBALIK dari state lokal, lalu state
 *     ditambal dari respons server: kebenaran tetap di backend, UI tidak
 *     menebak.
 *   - Aksi massal dibungkus `runBusy` tunggal supaya tombol tidak bisa
 *     ditekan dua kali saat request masih berjalan.
 */
import { useCallback, useMemo, useState } from "react"

import {
  Archive,
  BellSlash,
  BellZ,
  MagnifyingGlass,
  Package,
  UserCircle,
} from "phosphor-react-native"
import { router } from "expo-router"

import { isApiError, userMessage } from "@/lib/api"
import { setRoomArchived, setRoomMuted, type ChatRoom } from "@/lib/api/chat"
import { haptic } from "@/lib/haptics"
import { ROUTES } from "@/lib/routes"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { useToast } from "@/components/ui/toast"

export type ChatRoomMenuProps = {
  open: boolean
  room: ChatRoom | null
  /** Username lawan bicara — membuka profilnya. */
  counterpartUsername?: string
  onClose: () => void
  /** Buka sheet pencarian pesan di layar. */
  onSearch: () => void
  /** Ruang diperbarui (bisu/arsip) — layar menambal state ruangnya. */
  onRoomChange: (patch: Partial<ChatRoom>) => void
}

export function ChatRoomMenu({
  open,
  room,
  counterpartUsername,
  onClose,
  onSearch,
  onRoomChange,
}: ChatRoomMenuProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const runBusy = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true)
      try {
        await action()
      } catch (err) {
        toast.show({
          title: "Gagal memperbarui percakapan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setBusy(false)
      }
    },
    [toast.show],
  )

  const actions: ActionSheetItem[] = useMemo(() => {
    const orderId = room?.orderId
    const items: ActionSheetItem[] = []
    if (orderId) {
      items.push({
        key: "order",
        label: "Lihat pesanan",
        icon: Package,
        onPress: () => router.push(ROUTES.orderDetail(orderId)),
      })
    }
    items.push({ key: "search", label: "Cari pesan", icon: MagnifyingGlass, onPress: onSearch })
    if (counterpartUsername) {
      items.push({
        key: "profile",
        label: "Lihat profil",
        icon: UserCircle,
        onPress: () => router.push(ROUTES.userProfile(counterpartUsername)),
      })
    }
    if (room) {
      items.push({
        key: "mute",
        label: room.isMuted ? "Kembalikan suara" : "Bisukan percakapan",
        icon: room.isMuted ? BellZ : BellSlash,
        disabled: busy,
        onPress: () =>
          void runBusy(async () => {
            const res = await setRoomMuted(room.id, room.isMuted !== true)
            onRoomChange({ isMuted: res.isMuted, mutedUntil: res.mutedUntil })
            haptic("success")
            toast.show({
              title: res.isMuted ? "Percakapan dibisukan" : "Suara percakapan dikembalikan",
              tone: "success",
              duration: 2500,
            })
          }),
      })
      items.push({
        key: "archive",
        label: room.isArchived ? "Keluarkan dari arsip" : "Arsipkan percakapan",
        icon: Archive,
        disabled: busy,
        onPress: () =>
          void runBusy(async () => {
            const res = await setRoomArchived(room.id, !room.isArchived)
            onRoomChange({ isArchived: res.isArchived })
            haptic("success")
            toast.show({
              title: res.isArchived
                ? "Percakapan diarsipkan"
                : "Percakapan dikeluarkan dari arsip",
              tone: "success",
              duration: 2500,
            })
          }),
      })
    }
    return items
  }, [busy, counterpartUsername, onRoomChange, onSearch, room, runBusy, toast.show])

  return (
    <ActionSheet
      visible={open}
      onRequestClose={onClose}
      title="Opsi percakapan"
      actions={actions}
    />
  )
}
