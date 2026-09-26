/**
 * Kahade — store jumlah chat belum dibaca (badge tab Pesan, CN-011).
 *
 * Pola sama dengan `lib/unread-count.ts` (store modul-level + useSyncExternalStore).
 *
 * Root cause CN-011: badge tab Pesan memakai total unread NOTIFIKASI
 * (`GET /v1/notifications/unread-count`) — notifikasi order/promo/dompet ikut
 * menyalakan badge Pesan, dan status baca chat tidak tercermin. Backend tidak
 * punya endpoint unread khusus chat, jadi angka dihitung dari
 * `GET /v1/chat/rooms` (field `unreadCount` per ruang, dijumlahkan).
 *
 * Keterbatasan: hanya halaman pertama (50 ruang) yang dijumlahkan — cukup
 * untuk badge; pengguna dengan >50 ruang aktif yang semuanya unread adalah
 * kasus tepi yang bisa diremehkan untuk badge.
 */
import { useEffect, useSyncExternalStore } from "react"
import { usePolling } from "@/lib/use-polling"
import { getSessionRevision, subscribeSession } from "@/lib/api/session"
import { api, isApiError } from "@/lib/api"

export type ChatUnreadState = {
  status: "idle" | "loading" | "success" | "error"
  /** null = tidak diketahui → badge disembunyikan */
  count: number | null
}

/** Poll 60 detik — sama seperti unread notifikasi; push chat me-refresh manual. */
export const CHAT_UNREAD_POLL_INTERVAL_MS = 60_000

let state: ChatUnreadState = { status: "idle", count: null }
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null
let generation = 0
let accountRevision = getSessionRevision()
subscribeSession(() => {
  if (accountRevision !== getSessionRevision()) {
    accountRevision = getSessionRevision()
    resetChatUnreadCount()
  }
})

function emit(next: ChatUnreadState) {
  state = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

/** Set langsung (mis. setelah markChatRoomRead → kurangi). */
export function setChatUnreadCount(count: number | null) {
  generation += 1
  inFlight = null
  emit({
    status: "success",
    count: count === null || !Number.isFinite(count) ? null : Math.max(0, Math.trunc(count)),
  })
}

/** Ambil ulang: jumlahkan unreadCount semua ruang di halaman pertama. */
export function refreshChatUnreadCount(): Promise<void> {
  if (inFlight) return inFlight
  const started = generation
  inFlight = (async () => {
    if (state.status === "idle") emit({ status: "loading", count: null })
    try {
      const res = await api.chat.listChatRooms({ page: 1, limit: 50 })
      const rooms = Array.isArray(res.data) ? res.data : []
      const total = rooms.reduce(
        (sum, r) => sum + (typeof r.unreadCount === "number" ? r.unreadCount : 0),
        0,
      )
      if (started === generation) emit({ status: "success", count: total })
    } catch (err) {
      if (started !== generation) return
      if (__DEV__ && !(isApiError(err) && err.code === "UNAUTHORIZED")) {
        console.warn("[kahade/chat-unread] gagal memuat unread chat:", err)
      }
      emit({ status: "error", count: state.count })
    } finally {
      if (started === generation) inFlight = null
    }
  })()
  return inFlight
}

/** Reset ke idle — panggil saat logout. */
export function resetChatUnreadCount() {
  generation += 1
  inFlight = null
  emit({ status: "idle", count: null })
}

/** Baca snapshot store tanpa memicu fetch. */
export function useChatUnreadCountState(): ChatUnreadState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Baca store + fetch awal, poll berkala, refresh saat app aktif.
 * Pasang SEKALI di layout yang hidup selama user login.
 */
export function useChatUnreadCount(opts: { enabled?: boolean } = {}): ChatUnreadState {
  const enabled = opts.enabled ?? true
  const snapshot = useChatUnreadCountState()

  useEffect(() => {
    if (!enabled) return
    void refreshChatUnreadCount()
  }, [enabled])

  usePolling(refreshChatUnreadCount, CHAT_UNREAD_POLL_INTERVAL_MS, enabled)
  return snapshot
}
