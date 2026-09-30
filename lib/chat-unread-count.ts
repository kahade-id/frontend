/**
 * Kahade — store jumlah chat belum dibaca (badge tab Pesan, CN-011).
 *
 * Pola sama dengan `lib/unread-count.ts` (store modul-level + useSyncExternalStore).
 *
 * NS-006 (perf-fix, 2026-09-29): badge TIDAK LAGI mengunduh 50 room tiap
 * 60 detik — memakai `GET /v1/chat/unread-count` (satu angka agregat dari
 * counter denormalisasi backend, bukan daftar room penuh).
 */
import { useEffect, useSyncExternalStore } from "react"
import { usePolling } from "@/lib/use-polling"
import { getSessionRevision, subscribeSession } from "@/lib/api/session"
import * as chatApi from "@/lib/api/chat"
import { isApiError } from "@/lib/api/errors"

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
  const nextCount = count === null || !Number.isFinite(count) ? null : Math.max(0, Math.trunc(count))
  // PERF-FIX (state audit): guard equality — lihat setUnreadCount.
  if (state.status === "success" && state.count === nextCount) return
  emit({
    status: "success",
    count: nextCount,
  })
}

/** Ambil ulang: SATU angka dari GET /v1/chat/unread-count (NS-006). */
export function refreshChatUnreadCount(): Promise<void> {
  if (inFlight) return inFlight
  const started = generation
  inFlight = (async () => {
    if (state.status === "idle") emit({ status: "loading", count: null })
    try {
      // ST-001 (audit performa): import domain langsung, bukan barrel @/lib/api.
      const body = await chatApi.getChatUnreadCount()
      const count =
        body && typeof body.unreadCount === "number" && Number.isFinite(body.unreadCount)
          ? Math.max(0, Math.trunc(body.unreadCount))
          : null
      if (started === generation) emit({ status: "success", count })
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
 * R1-007 (2026-09-29, audit render-perf): selector primitif — konsumen yang
 * hanya butuh angka (badge tab) berlangganan `count` saja, sehingga transisi
 * `status` tanpa perubahan angka tidak memicu re-render.
 */
export function useChatUnreadCountNumber(): number | null {
  return useSyncExternalStore(subscribe, () => state.count, () => state.count)
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
