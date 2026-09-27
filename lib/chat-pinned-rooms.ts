/**
 * Kahade — ruang chat terpin, tersinkron backend (batch 43 FE-CHAT, 2026-09-28).
 *
 * REVISI dari versi per-perangkat (item 18, 2026-09-28): backend kini punya
 * endpoint pin RUANG (GET /v1/chat/pinned, POST/DELETE
 * /v1/chat/rooms/{id}/pin) — pin ikut akun dan sinkron antar perangkat.
 * Penyimpanan lokal lama (SecureStore `chat.pinnedRooms.v1`) TIDAK lagi
 * dipakai; bila kunci itu masih ada, ia diabaikan (bukan dimigrasi — pin
 * lama per perangkat tidak bisa diverifikasi ke akun tanpa sesi).
 *
 * Pola tetap memory-first + hydration async seperti sebelumnya supaya API
 * publik (`isRoomPinned`, `sortRoomsPinnedFirst`, `subscribePinnedRooms`,
 * `toggleRoomPinned`) tidak berubah bagi pemanggil (`app/(tabs)/chat.tsx`).
 * `sortRoomsPinnedFirst` kini menghormati `position` backend (kecil = atas).
 *
 * Kegagalan backend bersifat graceful: daftar pin kosong, toggle melempar
 * (pemanggil menampilkan toast) — pin tidak pernah ditulis lokal supaya
 * tidak ada dua sumber kebenaran.
 */
import { logWarn } from "@/lib/telemetry"
import {
  listPinnedChatRooms,
  pinChatRoomOnServer,
  unpinChatRoomOnServer,
} from "@/lib/api/chat"

/** roomId → position (kecil = paling atas). */
const memory = new Map<string, number>()
let hydratePromise: Promise<void> | null = null

async function ensureHydrated(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = listPinnedChatRooms()
      .then((pins) => {
        memory.clear()
        for (const pin of pins) memory.set(pin.roomId, pin.position)
      })
      .catch((err: unknown) => {
        // Graceful: tanpa pin, daftar tetap tampil normal (tanpa sematan).
        logWarn("chat:pinned-rooms-hydrate", err)
        memory.clear()
      })
  }
  await hydratePromise
}

/** Apakah ruang ini terpin. Panggil setelah `ensurePinnedLoaded`. */
export function isRoomPinned(roomId: string): boolean {
  return memory.has(roomId)
}

/** Muat pin tersimpan dari backend (idempoten). */
export function ensurePinnedLoaded(): Promise<void> {
  return ensureHydrated()
}

/**
 * Toggle pin ruang di backend. Mengembalikan state baru. Perubahan
 * diberitahu ke UI lewat `subscribePinnedRooms`. Melempar bila request
 * gagal — pemanggil menampilkan toast (tidak ada fallback lokal).
 */
export async function toggleRoomPinned(roomId: string): Promise<boolean> {
  await ensureHydrated()
  if (memory.has(roomId)) {
    await unpinChatRoomOnServer(roomId)
    memory.delete(roomId)
  } else {
    const res = await pinChatRoomOnServer(roomId)
    memory.set(roomId, typeof res?.position === "number" ? res.position : memory.size)
  }
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
 * Sortir ruang: terpin dulu (urut `position` backend), sisanya mengikuti
 * urutan semula. Murni tampilan — tidak mengubah API.
 */
export function sortRoomsPinnedFirst<T extends { id: string }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => {
    const pa = memory.get(a.id)
    const pb = memory.get(b.id)
    if (pa === undefined && pb === undefined) return 0
    if (pa === undefined) return 1
    if (pb === undefined) return -1
    return pa - pb
  })
}

/** Refresh paksa dari backend (mis. setelah kembali dari layar lain). */
export async function refreshPinnedRooms(): Promise<void> {
  hydratePromise = null
  await ensureHydrated()
  notify()
}

/** Reset untuk test. */
export function __resetPinnedRoomsForTest(): void {
  memory.clear()
  hydratePromise = null
  listeners.clear()
}
