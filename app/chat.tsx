/**
 * Screen — Ruang Chat (GET /v1/chat/rooms). List ChatRoomListItem.
 *
 * v3 (2026-09-21, permintaan pemilik produk):
 *   - Baris list = DUA baris teks (nama · order id / preview · waktu), tanpa
 *     chevron dan TANPA garis pemisah sama sekali — termasuk di baris pertama.
 *     Garis di atas baris pertama dulu terbaca sebagai "separator nyangkut"
 *     karena header sudah punya border-b sendiri (§6: satu pemisah, satu kali).
 *   - Tekan lama TIDAK lagi membuka ActionSheet: baris masuk MODE PILIH
 *     (pola yang sama dengan layar Notifikasi), lalu aksi massal
 *     Bisukan/Arsipkan tersedia sebagai ikon di header. Satu ketukan panjang
 *     = satu langkah, bukan dua (buka sheet → pilih aksi).
 *   - Umpan balik ripple di setiap baris (PressableScale `ripple`).
 *   - Skeleton muat-pertama sebentuk baris chat (bukan 4 kartu h-24 milik
 *     <ListLoading/>) supaya daftar tidak "melompat" saat data tiba.
 *
 * Header: icon BACK di kiri (konsisten layar stack lain) + icon ARSIP di kanan
 * untuk membuka/menutup "Daftar terarsip" — pintu masuk tetap ada walau ruang
 * terarsip tidak pernah boleh lenyap diam-diam.
 *
 * Fitur lanjutan (spec backend chat):
 *   - Dot online dari `isOnline`/`lastSeenAt` + ikon bel-slash untuk `isMuted`.
 *   - Mode pilih: Arsipkan/Buka arsip (PUT /archive) dan Bisukan/Bukakan
 *     (PUT /mute) untuk BANYAK ruang sekaligus. Backend tidak punya endpoint
 *     batch, jadi permintaan dikirim paralel dengan `Promise.allSettled`:
 *     sebagian gagal tetap memperbarui yang berhasil dan melaporkan sisanya
 *     (bukan rollback senyap).
 *   - Ruang terarsip ditampilkan di "Daftar terarsip" (bukan disembunyikan).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Archive, BellSlash, BellZ, Chats, X } from "phosphor-react-native"
import { router } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  CHAT_PAGE_SIZE,
  setRoomArchived,
  setRoomMuted,
  type ChatRoom,
} from "@/lib/api/chat"
import { formatDateTime, truncateMiddle } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"

import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"

/**
 * Batas jumlah ruang yang bisa dipilih sekaligus. Backend tidak punya
 * endpoint batch (satu PUT per ruang), jadi batas ini menjaga agar satu
 * ketukan tidak memicu ratusan request paralel; 50 selaras dengan
 * BatchNotificationIdsDto di layar Notifikasi.
 */
const SELECTION_MAX = 50
/** Baris skeleton saat muat pertama — sebentuk <ChatRoomListItem>. */
const SKELETON_COUNT = 7

function ChatSkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 px-4 py-2.5">
      <Skeleton shape="circle" width={48} height={48} />
      <View className="min-w-0 flex-1 gap-1.5">
        <Skeleton height={14} style={{ width: "45%" }} />
        <Skeleton height={12} style={{ width: "80%" }} />
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const query = usePaginatedQuery<ChatRoom>(
    "chat-rooms",
    (page, signal) => api.chat.listChatRooms({ page, limit: CHAT_PAGE_SIZE }, signal),
    // F-01 (audit): kembali dari ruang chat — unread/lastMessage di daftar
    // disegarkan diam-diam tanpa menunggu poll atau pull-to-refresh.
    // C-08 (audit): percakapan yang baru dibalas harus naik ke atas.
    { refreshOnFocus: true, compare: byTimestampDesc<ChatRoom>((room) => room.updatedAt) },
  )
  const [archiveOpen, setArchiveOpen] = useState(false)

  // ── Mode pilih (aksi massal arsip/bisu, tanpa ActionSheet) ──
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)

  const archivedRooms = query.data.filter((r) => r.isArchived)
  const visibleRooms = query.data.filter((r) => !r.isArchived)
  const shownRooms = archiveOpen ? archivedRooms : visibleRooms

  // Terapkan hasil arsip/mute ke baris list tanpa memuat ulang seluruhnya.
  const patchRoom = useCallback(
    (id: string, patch: Partial<ChatRoom>) => {
      query.setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    },
    [query.setData],
  )

  const selectedRooms = useMemo(
    () => shownRooms.filter((r) => selected.has(r.id)),
    [shownRooms, selected],
  )
  const selectedCount = selected.size
  /**
   * Arah aksi toggle mengikuti isi pilihan: selama masih ada ruang yang
   * BELUM bisu, satu ketukan membisukan semuanya (niat pengguna memilih
   * beberapa ruang hampir selalu "berhentikan bunyi ini"), sebaliknya
   * mengembalikan suara.
   */
  const anyUnmuted = selectedRooms.some((r) => r.isMuted !== true)

  const exitSelect = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  const enterSelect = useCallback((id: string) => {
    haptic("select")
    setSelected(new Set([id]))
    setSelecting(true)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < SELECTION_MAX) next.add(id)
      return next
    })
    haptic("select")
  }, [])

  // Ganti daftar (arsip ↔ aktif) membatalkan pilihan: id yang dipilih bisa
  // tidak ada lagi di daftar yang sedang tampil.
  useEffect(() => {
    exitSelect()
  }, [archiveOpen, exitSelect])

  /**
   * Jalankan satu aksi untuk semua ruang terpilih. `Promise.allSettled` (bukan
   * `all`): satu ruang yang gagal (403/404 karena ruang dihapus lawan bicara)
   * tidak boleh membatalkan pembaruan ruang lain yang sudah berhasil di
   * server. Kegagalan dilaporkan sekali, ringkas.
   */
  const runBatch = useCallback(
    async (
      action: (room: ChatRoom) => Promise<Partial<ChatRoom>>,
      successTitle: string,
      failTitle: string,
    ) => {
      if (selectedRooms.length === 0 || batchBusy) return
      setBatchBusy(true)
      const targets = selectedRooms
      const results = await Promise.allSettled(targets.map((room) => action(room)))
      let ok = 0
      let firstError: unknown
      results.forEach((res, i) => {
        const room = targets[i]!
        if (res.status === "fulfilled") {
          ok += 1
          patchRoom(room.id, res.value)
        } else {
          firstError ??= res.reason
        }
      })
      setBatchBusy(false)
      exitSelect()
      if (ok > 0) {
        haptic("success")
        toast.show({
          title: ok === 1 ? successTitle : `${successTitle} (${ok} percakapan)`,
          tone: "success",
          duration: 2500,
        })
      }
      if (firstError) {
        toast.show({
          title: failTitle,
          description: isApiError(firstError) ? userMessage(firstError) : undefined,
          tone: "danger",
        })
      }
    },
    [batchBusy, exitSelect, patchRoom, selectedRooms, toast.show],
  )

  const handleBatchMute = useCallback(() => {
    const next = anyUnmuted
    return runBatch(
      async (room) => {
        const res = await setRoomMuted(room.id, next)
        return { isMuted: res.isMuted, mutedUntil: res.mutedUntil }
      },
      next ? "Percakapan dibisukan" : "Suara percakapan dikembalikan",
      "Gagal memperbarui bisu percakapan",
    )
  }, [anyUnmuted, runBatch])

  const handleBatchArchive = useCallback(() => {
    // Di daftar terarsip aksi yang sama berarti "buka arsip" — satu ikon,
    // arah mengikuti ruang yang dipilih (bukan mode tampilan).
    return runBatch(
      async (room) => {
        const res = await setRoomArchived(room.id, !room.isArchived)
        return { isArchived: res.isArchived }
      },
      archiveOpen ? "Percakapan dikeluarkan dari arsip" : "Percakapan diarsipkan",
      "Gagal memperbarui arsip percakapan",
    )
  }, [archiveOpen, runBatch])

  return (
    <Screen edges={["top"]} padded={false}>
      {selecting ? (
        <Header
          // Jumlah dipilih lewat translate(): template literal di atribut JSX
          // tidak terbaca generator katalog i18n (hanya children JSX, properti
          // objek, dan argumen translate()), jadi copy dinamis harus dibungkus.
          title={selectedCount > 0 ? translate(`${selectedCount} dipilih`) : "Pilih percakapan"}
          showBack={false}
          left={
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              ripple
              accessibilityLabel="Batal memilih"
              onPress={exitSelect}
            />
          }
          right={
            <>
              <IconButton
                icon={anyUnmuted ? BellSlash : BellZ}
                size="sm"
                variant="ghost"
                ripple
                disabled={selectedCount === 0 || batchBusy}
                accessibilityLabel={
                  anyUnmuted ? "Bisukan percakapan terpilih" : "Kembalikan suara percakapan terpilih"
                }
                onPress={() => void handleBatchMute()}
              />
              <IconButton
                icon={Archive}
                size="sm"
                variant="ghost"
                ripple
                disabled={selectedCount === 0 || batchBusy}
                accessibilityLabel={
                  archiveOpen
                    ? "Keluarkan percakapan terpilih dari arsip"
                    : "Arsipkan percakapan terpilih"
                }
                onPress={() => void handleBatchArchive()}
              />
            </>
          }
        />
      ) : (
        <Header
          title={archiveOpen ? "Diarsipkan" : "Chat"}
          right={
            <IconButton
              icon={Archive}
              size="md"
              variant="ghost"
              ripple
              active={archiveOpen}
              accessibilityLabel={archiveOpen ? "Tutup daftar terarsip" : "Buka daftar terarsip"}
              onPress={() => setArchiveOpen((v) => !v)}
            />
          }
        />
      )}
      <PaginatedList
        {...query}
        // ChatRoomListItem memasang px-4 sendiri. `padded` default menambah
        // paddingHorizontal 20px lagi di contentContainer -> baris menjorok
        // dan tidak sejajar Header di atasnya. Sama seperti app/notifications.tsx.
        padded={false}
        data={shownRooms}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        // Baris chat punya padding vertikal sendiri; gap antar baris 0 menjaga
        // irama rapat ala aplikasi pesan (satu layar memuat lebih banyak ruang).
        gap={0}
        loadingPlaceholder={
          <SkeletonGroup>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <ChatSkeletonRow key={index} />
            ))}
          </SkeletonGroup>
        }
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          archiveOpen ? (
            <EmptyState
              icon={Archive}
              title="Belum ada percakapan terarsip"
              description="Percakapan yang Anda arsipkan akan tersimpan di sini."
            />
          ) : (
            <EmptyState
              icon={Chats}
              title="Belum ada percakapan"
              description="Mulai chat dengan lawan transaksi Anda."
            />
          )
        }
        renderItem={({ item }) => (
          <ChatRoomListItem
            name={item.counterpart?.fullName ?? `@${item.counterpart?.username ?? "—"}`}
            avatar={item.counterpart?.avatarUrl ? { uri: item.counterpart.avatarUrl } : undefined}
            online={item.isOnline === true}
            muted={item.isMuted === true}
            lastMessage={
              item.lastMessage
                ? {
                    text: item.lastMessage.text ?? "",
                    fromSelf: item.lastMessage.fromUser,
                  }
                : undefined
            }
            time={item.lastMessage ? formatDateTime(item.lastMessage.createdAt) : undefined}
            unreadCount={item.unreadCount}
            // Order id saja (tanpa kata "Pesanan") — metadata ringkas di kanan
            // baris pertama; panjangnya dipotong di tengah agar nomor tetap
            // bisa dikenali dari kepala & ekornya.
            context={item.orderId ? truncateMiddle(item.orderId, 6, 4) : undefined}
            selecting={selecting}
            selected={selected.has(item.id)}
            onPress={() => {
              if (selecting) {
                toggleSelect(item.id)
                return
              }
              router.push(
                ROUTES.chatRoom(
                  item.id,
                  // C-06 (audit): layar ruang hanya mencari judul di 30 ruang
                  // pertama — nama dikirim lewat param agar ruang ke-31+ tidak
                  // jatuh ke "Percakapan".
                  item.counterpart?.fullName ??
                    (item.counterpart?.username
                      ? `@${item.counterpart.username}`
                      : (item.subject ?? undefined)),
                ),
              )
            }}
            onLongPress={() => {
              if (selecting) toggleSelect(item.id)
              else enterSelect(item.id)
            }}
          />
        )}
      />
    </Screen>
  )
}
