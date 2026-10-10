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
import { translate } from "@/lib/i18n"
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
  /**
   * Audit chat D9: pencarian cepat di pesan yang SUDAH dimuat (bar sorot +
   * sebelumnya/berikutnya). Ikon cari di header kini membuka sheet seluruh
   * riwayat, jadi jalan ke bar ini lewat menu.
   */
  onSearchLoaded?: () => void
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
}

export function ChatRoomMenu({
  open,
  room,
  counterpartUsername,
  onClose,
  onSearch,
  onSearchLoaded,
  onRoomChange,
  onExport,
  onOpenStarred,
  onOpenCreateOrder,
  onOpenReport,
  isSelfChat = false,
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
          title: translate("Gagal memperbarui percakapan"),
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
        label: translate("Lihat pesanan"),
        icon: Package,
        onPress: () => router.push(ROUTES.orderDetail(orderId)),
      })
    }
    items.push({
      key: "search",
      label: translate("Cari semua pesan"),
      description: translate("Telusuri seluruh riwayat di server"),
      icon: MagnifyingGlass,
      onPress: onSearch,
    })
    if (onSearchLoaded) {
      items.push({
        key: "search-loaded",
        label: translate("Cari di pesan termuat"),
        description: translate("Sorot hasil langsung di percakapan"),
        icon: MagnifyingGlass,
        onPress: onSearchLoaded,
      })
    }
    // Batch 43: ekspor, bintang — selalu tersedia di menu.
    // 2026-10-03: Polling DIHAPUS dari menu (sudah ada di sheet lampiran).
    if (onExport) {
      items.push({ key: "export", label: translate("Ekspor chat (TXT)"), icon: FileArrowDown, onPress: onExport })
    }
    if (onOpenStarred) {
      items.push({ key: "starred", label: translate("Pesan berbintang"), icon: Star, onPress: onOpenStarred })
    }
    // Batch 43: buat transaksi dari chat — uang tetap lewat Kahade, bukan
    // transfer langsung (keputusan produk batch 43).
    // 2026-10-08: deskripsi tanpa istilah internal ("escrow") — pengguna
    // hanya perlu tahu dananya aman sampai barang diterima.
    if (onOpenCreateOrder && !isSelfChat) {
      items.push({
        key: "create-order",
        label: translate("Buat transaksi"),
        description: translate("Dana Anda aman sampai barang diterima"),
        icon: Receipt,
        onPress: onOpenCreateOrder,
      })
    }
    if (counterpartUsername) {
      items.push({
        key: "profile",
        label: translate("Lihat profil"),
        icon: UserCircle,
        onPress: () => router.push(ROUTES.userProfile(counterpartUsername)),
      })
    }
    // Batch 43: laporkan + blokir dari menu ruang — disembunyikan untuk
    // self-chat (tidak ada lawan bicara untuk dilaporkan/diblokir).
    if (onOpenReport && !isSelfChat && room?.counterpart) {
      items.push({
        key: "report",
        label: translate("Laporkan / Blokir"),
        description: translate("Laporkan pesan atau blokir pengguna"),
        icon: Flag,
        onPress: onOpenReport,
      })
    }
    // Audit Pesan 2026-10-10 (#9e): bisukan/arsip OPTIMISTIS — label menu &
    // state ruang berubah seketika (sebelum `await`), dikembalikan persis ke
    // nilai semula bila server menolak. Dulu `onRoomChange` baru dipanggil
    // setelah respons: di koneksi lambat ketukan terasa "tidak terjadi apa-apa".
    // #10: label/toast lewat translate() — dulu literal Indonesia.
    if (room) {
      items.push({
        key: "mute",
        label: room.isMuted ? translate("Kembalikan suara") : translate("Bisukan percakapan"),
        icon: room.isMuted ? BellZ : BellSlash,
        disabled: busy,
        onPress: () => {
          const wantMuted = room.isMuted !== true
          const rollback = { isMuted: room.isMuted, mutedUntil: room.mutedUntil }
          onRoomChange({ isMuted: wantMuted, mutedUntil: wantMuted ? room.mutedUntil : null })
          void runBusy(async () => {
            try {
              const res = await setRoomMuted(room.id, wantMuted)
              onRoomChange({ isMuted: res.isMuted, mutedUntil: res.mutedUntil })
            } catch (err) {
              onRoomChange(rollback)
              throw err
            }
            haptic("success")
            toast.show({
              title: wantMuted
                ? translate("Percakapan dibisukan")
                : translate("Suara percakapan dikembalikan"),
              tone: "success",
              duration: 2500,
            })
          })
        },
      })
      items.push({
        key: "archive",
        label: room.isArchived ? translate("Keluarkan dari arsip") : translate("Arsipkan percakapan"),
        icon: Archive,
        disabled: busy,
        onPress: () => {
          const wantArchived = !room.isArchived
          const rollback = { isArchived: room.isArchived }
          onRoomChange({ isArchived: wantArchived })
          void runBusy(async () => {
            try {
              const res = await setRoomArchived(room.id, wantArchived)
              onRoomChange({ isArchived: res.isArchived })
            } catch (err) {
              onRoomChange(rollback)
              throw err
            }
            haptic("success")
            toast.show({
              title: wantArchived
                ? translate("Percakapan diarsipkan")
                : translate("Percakapan dikeluarkan dari arsip"),
              tone: "success",
              duration: 2500,
            })
          })
        },
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
    onSearchLoaded,
    room,
    runBusy,
    toast.show,
  ])

  return (
    <>
      <ActionSheet
        visible={open}
        onRequestClose={onClose}
        title="Opsi percakapan"
        actions={actions}
      />
    </>
  )
}
