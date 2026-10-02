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
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { View } from "react-native"

import {
  Archive,
  BellSlash,
  BellZ,
  FileArrowDown,
  Flag,
  MagnifyingGlass,
  Package,
  Receipt,
  Star,
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
  // ── Batch 43 FE-CHAT ──────────────────────────────────────────────
  /** Ekspor riwayat chat (TXT). */
  onExport?: () => void
  /** Buka sheet pesan berbintang. */
  onOpenStarred?: () => void
  /** Buka sheet buat transaksi (disembunyikan untuk self-chat). */
  onOpenCreateOrder?: () => void
  /** Buka sheet laporkan + blokir (disembunyikan untuk self-chat). */
  onOpenReport?: () => void
  /** Self-chat — sembunyikan blokir/lapor & buat transaksi. */
  isSelfChat?: boolean
  /** Tampilkan peringatan escrow di atas menu (2026-10-02: pindahan dari banner atas). */
  escrowWarning?: ReactNode
}

export function ChatRoomMenu({
  open,
  room,
  counterpartUsername,
  onClose,
  onSearch,
  onRoomChange,
  onExport,
  onOpenStarred,
  onOpenCreateOrder,
  onOpenReport,
  isSelfChat = false,
  escrowWarning,
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
    items.push({ key: "search", label: "Cari semua pesan", description: "Telusuri seluruh riwayat di server", icon: MagnifyingGlass, onPress: onSearch })
    // Batch 43: ekspor, bintang — selalu tersedia di menu.
    // 2026-10-03: Polling DIHAPUS dari menu (sudah ada di sheet lampiran).
    if (onExport) {
      items.push({ key: "export", label: "Ekspor chat (TXT)", icon: FileArrowDown, onPress: onExport })
    }
    if (onOpenStarred) {
      items.push({ key: "starred", label: "Pesan berbintang", icon: Star, onPress: onOpenStarred })
    }
    // Batch 43: buat transaksi dari chat — uang tetap via escrow, bukan
    // transfer langsung (keputusan produk batch 43).
    if (onOpenCreateOrder && !isSelfChat) {
      items.push({
        key: "create-order",
        label: "Buat transaksi",
        description: "Dana lewat escrow Kahade",
        icon: Receipt,
        onPress: onOpenCreateOrder,
      })
    }
    if (counterpartUsername) {
      items.push({
        key: "profile",
        label: "Lihat profil",
        icon: UserCircle,
        onPress: () => router.push(ROUTES.userProfile(counterpartUsername)),
      })
    }
    // Batch 43: laporkan + blokir dari menu ruang — disembunyikan untuk
    // self-chat (tidak ada lawan bicara untuk dilaporkan/diblokir).
    if (onOpenReport && !isSelfChat && room?.counterpart) {
      items.push({
        key: "report",
        label: "Laporkan / Blokir",
        description: "Laporkan pesan atau blokir pengguna",
        icon: Flag,
        onPress: onOpenReport,
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
  }, [
    busy,
    counterpartUsername,
    isSelfChat,
    onExport,
    onOpenCreateOrder,
    onOpenReport,
    onOpenStarred,
    onRoomChange,
    onSearch,
    room,
    runBusy,
    toast.show,
  ])

  return (
    <>
      {escrowWarning ? <View className="px-5 pb-2">{escrowWarning}</View> : null}
      <ActionSheet
        visible={open}
        onRequestClose={onClose}
        title="Opsi percakapan"
        actions={actions}
      />
    </>
  )
}
