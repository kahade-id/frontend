/**
 * Kahade — sheet "Teruskan ke…" (picker ruang tujuan).
 *
 * GET    /v1/chat/rooms?page&limit          (daftar tujuan, paginasi)
 * POST   /v1/chat/rooms/{roomId}/messages/{messageId}/forward
 *
 * Kenapa dipisah dari layar ruang chat (G-11: layar itu hanya boleh menyusut):
 * picker ini punya siklus datanya sendiri — paginasi ruang, dedupe, dan
 * pengiriman per pesan. Layar ruang chat hanya menyerahkan daftar pesan yang
 * dipilih lewat `targets` dan menerima `onForwarded(count)`.
 *
 * Keputusan non-obvious:
 *   - C-10 (audit): dulu hanya 50 ruang pertama DAN hanya yang lawan
 *     bicaranya sama — fitur nyaris tak berguna. Endpoint forward menerima
 *     array `targetRoomIds` ruang APA pun, jadi picker memuat SEMUA ruang
 *     (paginasi 50/halaman) kecuali ruang aktif.
 *   - Satu-ke-banyak: endpoint menerima banyak ruang tetapi hanya SATU
 *     messageId, jadi beberapa pesan terpilih dikirim paralel lewat
 *     `Promise.allSettled` — satu pesan yang ditolak server (mis. sudah
 *     dihapus) tidak membatalkan sisanya, dan kegagalannya dilaporkan sekali
 *     (bukan satu toast per pesan).
 *   - Baris tujuan memakai avatar + nama (bukan teks saja): picker panjang
 *     dikenali lewat wajah, bukan dibaca satu per satu.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"

import { Chats, PaperPlaneRight } from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { forwardChatMessage, type ChatMessage, type ChatRoom } from "@/lib/api/chat"
import { haptic } from "@/lib/haptics"
import { logWarn } from "@/lib/telemetry"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Icon } from "@/components/ui/icon"
import { ListLoading } from "@/components/ui/paginated-list"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export type ChatForwardSheetProps = {
  /** Sheet terbuka. */
  open: boolean
  /** Ruang asal pesan. */
  roomId?: string
  /** Pesan yang diteruskan (satu atau banyak, dari mode pilih). */
  targets: ChatMessage[]
  onClose: () => void
  /** Minimal satu pesan berhasil diteruskan — layar keluar dari mode pilih. */
  onForwarded: (count: number) => void
}

/** Ukuran halaman daftar ruang tujuan. */
const FORWARD_PAGE_SIZE = 50

export function ChatForwardSheet({
  open,
  roomId,
  targets,
  onClose,
  onForwarded,
}: ChatForwardSheetProps) {
  const toast = useToast()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)
  const page = useRef(1)
  const requestId = useRef(0)

  const loadPage = useCallback(
    async (next: number) => {
      if (!roomId) return
      const request = ++requestId.current
      setLoading(true)
      try {
        const res = await api.chat.listChatRooms({ page: next, limit: FORWARD_PAGE_SIZE })
        if (request !== requestId.current) return
        const candidates = res.data.filter((r) => r.id !== roomId)
        setRooms((prev) => {
          if (next === 1) return candidates
          const seen = new Set(prev.map((r) => r.id))
          return [...prev, ...candidates.filter((r) => !seen.has(r.id))]
        })
        page.current = next
        setHasMore(next < res.meta.totalPages)
      } catch (err) {
        logWarn("chat:forward-rooms", err)
        toast.show({ title: "Gagal memuat daftar percakapan", tone: "danger" })
      } finally {
        if (request === requestId.current) setLoading(false)
      }
    },
    [roomId, toast.show],
  )

  // Buka → mulai dari halaman 1. requestId membuat respons halaman lama
  // (sheet sempat ditutup lalu dibuka lagi) tidak menimpa daftar baru.
  useEffect(() => {
    if (!open) return
    setRooms([])
    setHasMore(false)
    page.current = 1
    void loadPage(1)
  }, [open, loadPage])

  const forwardTo = useCallback(
    async (targetRoomId: string) => {
      if (!roomId || targets.length === 0 || sending) return
      setSending(true)
      const results = await Promise.allSettled(
        targets.map((message) => forwardChatMessage(roomId, message.id, [targetRoomId])),
      )
      let sent = 0
      let skipReason: string | undefined
      let firstError: unknown
      results.forEach((res) => {
        if (res.status !== "fulfilled") {
          firstError ??= res.reason
          return
        }
        if (res.value.skipped.length > 0) skipReason ??= res.value.skipped[0]?.reason
        else sent += 1
      })
      setSending(false)
      if (sent > 0) {
        haptic("success")
        toast.show({
          title: sent === 1 ? "Pesan diteruskan" : `${sent} pesan diteruskan`,
          tone: "success",
          duration: 2500,
        })
        onForwarded(sent)
        return
      }
      if (skipReason) {
        toast.show({ title: "Pesan tidak diteruskan", description: skipReason, tone: "danger" })
      } else if (firstError) {
        toast.show({
          title: "Gagal meneruskan pesan",
          description: isApiError(firstError) ? userMessage(firstError) : undefined,
          tone: "danger",
        })
      }
    },
    [onForwarded, roomId, sending, targets, toast.show],
  )

  // Properti objek (bukan const ternary biasa): generator katalog i18n membaca
  // literal di properti bernama `description`, jadi kedua varian terkatalog.
  const copy = {
    description:
      targets.length > 1
        ? `${targets.length} pesan akan diteruskan sekaligus.`
        : "Pilih percakapan tujuan pesan.",
  }

  return (
    <BottomSheet
      avoidKeyboard
      visible={open}
      onRequestClose={onClose}
      title="Teruskan ke…"
      description={copy.description}
      showHandle={false}
    >
      <View className="px-2 pb-2">
        {rooms.map((r) => {
          const name = r.counterpart?.fullName ?? `@${r.counterpart?.username ?? "—"}`
          return (
            <PressableScale
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={translate("Teruskan ke {x}", { x: name })}
              disabled={sending}
              onPress={() => void forwardTo(r.id)}
              containerClassName={cn("rounded-md px-3 py-2.5", focusRing)}
              // kelas baris + lebar penuh di className (View isi PressableScale);
              // di containerClassName `flex-row` tidak menyentuh anak (S8).
              className="w-full flex-row items-center gap-3"
            >
              <Avatar
                size="md"
                name={name}
                source={r.counterpart?.avatarUrl ? { uri: r.counterpart.avatarUrl } : undefined}
              />
              <View className="min-w-0 flex-1">
                <Text variant="body" weight={500} numberOfLines={1}>
                  {name}
                </Text>
                {r.subject ? (
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {r.subject}
                  </Text>
                ) : null}
              </View>
              <Icon icon={PaperPlaneRight} size="sm" tone="default" />
            </PressableScale>
          )
        })}
        {loading ? (
          <View className="py-2">
            <ListLoading />
          </View>
        ) : null}
        {!loading && rooms.length === 0 ? (
          <EmptyState
            icon={Chats}
            title="Belum ada percakapan lain"
            description="Pesan dapat diteruskan ke percakapan Anda yang lain."
          />
        ) : null}
        {hasMore && !loading ? (
          <Button variant="ghost" fullWidth onPress={() => void loadPage(page.current + 1)}>
            Muat percakapan lain
          </Button>
        ) : null}
      </View>
    </BottomSheet>
  )
}
