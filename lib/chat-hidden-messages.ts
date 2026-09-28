/**
 * Kahade — "hapus untuk saya" pada pesan chat (B08).
 *
 * Backend hanya mengenal hapus-untuk-semua-pihak (soft delete `isDeleted`
 * untuk semua peserta; tidak ada cakupan per-pengguna dan tidak ada batas
 * waktu hapus di server). Untuk cakupan "hanya untuk saya", klien
 * menyembunyikan pesan SECARA LOKAL: id pesan disimpan per room, dan thread
 * memfilter id tersebut saat render.
 *
 * Yang disimpan HANYA id pesan (non-sensitif) — bukan isi pesan. Persist
 * ringan via kunci dinamis `chatHiddenKey(roomId)` (pola chat-drafts).
 */
import {
  chatHiddenKey,
  deleteRawItem,
  getRawItem,
  setRawItem,
} from "@/lib/secure-storage"

const memory = new Map<string, Set<string>>()
const hydrated = new Set<string>()

function persist(roomId: string): void {
  const key = chatHiddenKey(roomId)
  const ids = memory.get(roomId)
  if (!ids || ids.size === 0) {
    void deleteRawItem(key).catch(() => {
      // Best-effort.
    })
    return
  }
  void setRawItem(key, JSON.stringify([...ids])).catch(() => {
    // Best-effort.
  })
}

/** Id pesan yang disembunyikan lokal di room ini. */
export function peekHiddenMessageIds(roomId: string): Set<string> {
  return new Set(memory.get(roomId) ?? [])
}

/** Sembunyikan satu pesan hanya di perangkat ini. */
export function hideMessageLocally(roomId: string, messageId: string): void {
  if (!roomId || !messageId) return
  const set = memory.get(roomId) ?? new Set<string>()
  set.add(messageId)
  memory.set(roomId, set)
  hydrated.add(roomId)
  persist(roomId)
}

/** Batalkan sembunyi lokal (dipakai bila pesan yang sama muncul lagi?). */
export function unhideMessageLocally(roomId: string, messageId: string): void {
  if (!roomId) return
  const set = memory.get(roomId)
  if (!set || !set.delete(messageId)) return
  hydrated.add(roomId)
  persist(roomId)
}

/**
 * Muat id tersembunyi room: memory dulu, lalu storage bila belum di-hydrate.
 * Dipanggil sekali saat room dibuka; hasilnya dipakai memfilter thread.
 */
export async function loadHiddenMessageIds(roomId: string): Promise<Set<string>> {
  if (!roomId) return new Set()
  const cached = memory.get(roomId)
  if (cached !== undefined) return new Set(cached)
  if (hydrated.has(roomId)) return new Set()
  hydrated.add(roomId)
  try {
    const stored = await getRawItem(chatHiddenKey(roomId))
    const parsed = stored ? (JSON.parse(stored) as unknown) : []
    const set = new Set(
      Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [],
    )
    memory.set(roomId, set)
    return new Set(set)
  } catch {
    memory.set(roomId, new Set())
    return new Set()
  }
}

/** @internal — dipakai test untuk isolasi antar kasus. */
export function __resetHiddenMessagesForTest(): void {
  memory.clear()
  hydrated.clear()
}
