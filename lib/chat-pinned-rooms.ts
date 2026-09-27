/**
 * Kahade — ruang chat terpin (per-perangkat, item 18, 2026-09-28).
 *
 * Backend belum punya endpoint pin ruang (yang ada hanya pin PESAN di room).
 * Pin ini murni preferensi tampilan per perangkat: ruang terpin disortir ke
 * atas daftar. Penyimpanan mengikuti pola `lib/chat-drafts.ts` —
 * `SecureStore` via `lib/secure-storage` (repo ini tidak memakai
 * AsyncStorage), memory-first + persist async.
 *
 * Di web persist jatuh ke memory proses (tidak masuk localStorage) — pin
 * hilang saat halaman di-reload, konsisten dengan draft chat.
 *
 * Sinkronisasi pin antar perangkat butuh keputusan produk + kerja backend —
 * dicatat, tidak diimplementasikan di sini.
 */
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

const STORAGE_KEY = "chat.pinnedRooms.v1"

const memory = new Set<string>()
let hydratePromise: Promise<void> | null = null

function parse(raw: string | null): Set<string> {
  const next = new Set<string>()
  if (!raw) return next
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (typeof id === "string" && id.length > 0) next.add(id)
      }
    }
  } catch (err: unknown) {
    logWarn("chat:pinned-parse", err)
  }
  return next
}

async function ensureHydrated(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = getRawItem(STORAGE_KEY)
      .then((raw) => {
        memory.clear()
        for (const id of parse(raw)) memory.add(id)
      })
      .catch((err: unknown) => {
        logWarn("chat:pinned-hydrate", err)
      })
  }
  await hydratePromise
}

async function persist(): Promise<void> {
  try {
    if (memory.size === 0) await deleteRawItem(STORAGE_KEY)
    else await setRawItem(STORAGE_KEY, JSON.stringify([...memory]))
  } catch (err: unknown) {
    logWarn("chat:pinned-persist", err)
  }
}

/** Apakah ruang ini terpin (per perangkat). Panggil setelah `ensurePinnedLoaded` / dari UI yang sudah load. */
export function isRoomPinned(roomId: string): boolean {
  return memory.has(roomId)
}

/** Muat pin tersimpan (idempoten). Panggil sekali saat daftar chat dibuka. */
export function ensurePinnedLoaded(): Promise<void> {
  return ensureHydrated()
}

/**
 * Toggle pin ruang. Mengembalikan state baru. Perubahan diberitahu ke UI
 * lewat `subscribePinnedRooms` (bukan event bus — satu subscriber daftar chat).
 */
export async function toggleRoomPinned(roomId: string): Promise<boolean> {
  await ensureHydrated()
  if (memory.has(roomId)) memory.delete(roomId)
  else memory.add(roomId)
  await persist()
  notify()
  return memory.has(roomId)
}

type PinnedListener = () => void
const listeners = new Set<PinnedListener>()

function notify(): void {
  for (const fn of listeners) fn()
}

/** Langganan perubahan pin — panggil unsubscribe saat unmount. */
export function subscribePinnedRooms(fn: PinnedListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Sortir ruang: terpin dulu, sisanya mengikuti urutan semula. Murni tampilan
 * — tidak mengubah API. Panggil setelah `ensurePinnedLoaded()`.
 */
export function sortRoomsPinnedFirst<T extends { id: string }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => {
    const pa = memory.has(a.id)
    const pb = memory.has(b.id)
    if (pa === pb) return 0
    return pa ? -1 : 1
  })
}

/** Reset untuk test. */
export function __resetPinnedRoomsForTest(): void {
  memory.clear()
  hydratePromise = null
  listeners.clear()
}
