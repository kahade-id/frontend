/**
 * Kahade — draft ketikan composer chat, tersimpan per roomId.
 *
 * Masalah: <ChatComposer> controlled — teks dipegang state layar
 * `app/chat/[roomId].tsx`. Saat user pindah layar (room unmount), ketikan
 * hilang. Modul ini menyimpan draft per roomId:
 *
 *   1. Memory Map (sinkron, sumber kebenaran utama) — selamat dari
 *      navigasi selama app hidup.
 *   2. Persist ringan ke SecureStore per kunci `chatDraftKey(roomId)` —
 *      selamat dari restart app. Debounce 800 ms supaya tiap ketikan tidak
 *      menulis Keychain/Keystore.
 *
 * Batasan yang disengaja:
 *   - SecureStore membatasi ±2048 byte per nilai. Draft > 1900 byte HANYA
 *     hidup di memory (tidak dipersist) — memotong diam-diam lebih buruk
 *     daripada draft yang hilang saat restart. Draft chat normal (≤2000
 *     karakter, CHAT_MESSAGE_MAX) hampir selalu muat.
 *   - Di web persist jatuh ke memory proses (lihat `setRawItem`) — isi chat
 *     tidak boleh mendarat di localStorage.
 *   - Draft TIDAK dihapus `clearSession()`: preferensi level perangkat,
 *     seperti `onboardingSeen` — logout bukan alasan membuang ketikan.
 *   - Draft dihapus saat pesan TERKIRIM (`clearChatDraft`), bukan saat layar
 *     ditutup — menutup room di tengah mengetik lalu kembali = draft kembali.
 */
import {
  chatDraftKey,
  deleteRawItem,
  getRawItem,
  setRawItem,
} from "@/lib/secure-storage"

/** Jeda debounce tulis persist setelah ketikan terakhir (ms). */
export const CHAT_DRAFT_PERSIST_DEBOUNCE_MS = 800
/** Batas aman byte per nilai SecureStore (2048), sisakan ruang. */
export const CHAT_DRAFT_MAX_PERSIST_BYTES = 1900

const memory = new Map<string, string>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
/** roomId yang sudah dimuat dari storage ke memory sesi ini. */
const hydrated = new Set<string>()

function byteLength(text: string): number {
  // TextEncoder tidak ada di semua runtime RN lama — hitung manual.
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else bytes += 3
    } else bytes += 3
  }
  return bytes
}

function persist(roomId: string, text: string): void {
  const key = chatDraftKey(roomId)
  if (text.length === 0) {
    void deleteRawItem(key).catch(() => {
      // Gagal hapus bukan fatal — memory tetap sumber kebenaran.
    })
    return
  }
  if (byteLength(text) > CHAT_DRAFT_MAX_PERSIST_BYTES) {
    // Terlalu besar untuk satu nilai SecureStore: biarkan di memory saja.
    return
  }
  void setRawItem(key, text).catch(() => {
    // Gagal persist bukan fatal — memory tetap sumber kebenaran.
  })
}

/**
 * Baca sinkron dari memory (dipakai render awal / hot path ketikan).
 * Mengembalikan `undefined` bila belum pernah disimpan sesi ini — pemanggil
 * yang butuh nilai dari storage memakai `loadChatDraft`.
 */
export function peekChatDraft(roomId: string): string | undefined {
  return memory.get(roomId)
}

/**
 * Simpan draft: memory ditulis SINKRON (sumber kebenaran), persist ke
 * SecureStore di-debounce. Aman dipanggil tiap `onChangeText`.
 */
export function saveChatDraft(roomId: string, text: string): void {
  if (!roomId) return
  memory.set(roomId, text)
  hydrated.add(roomId)
  const prev = pendingTimers.get(roomId)
  if (prev) clearTimeout(prev)
  pendingTimers.set(
    roomId,
    setTimeout(() => {
      pendingTimers.delete(roomId)
      persist(roomId, text)
    }, CHAT_DRAFT_PERSIST_DEBOUNCE_MS),
  )
}

/**
 * Muat draft room: memory dulu, lalu SecureStore bila belum di-hydrate sesi
 * ini. Dipakai sekali saat room dibuka.
 */
export async function loadChatDraft(roomId: string): Promise<string> {
  if (!roomId) return ""
  const cached = memory.get(roomId)
  if (cached !== undefined) return cached
  if (hydrated.has(roomId)) return ""
  hydrated.add(roomId)
  try {
    const stored = await getRawItem(chatDraftKey(roomId))
    if (stored) memory.set(roomId, stored)
    return stored ?? ""
  } catch {
    return ""
  }
}

/**
 * Hapus draft: dipanggil setelah pesan TERKIRIM. Memory + storage dihapus
 * segera (tidak menunggu debounce — timer yang menggantung dibatalkan).
 */
export function clearChatDraft(roomId: string): void {
  if (!roomId) return
  memory.delete(roomId)
  hydrated.add(roomId)
  const prev = pendingTimers.get(roomId)
  if (prev) {
    clearTimeout(prev)
    pendingTimers.delete(roomId)
  }
  void deleteRawItem(chatDraftKey(roomId)).catch(() => {
    // Best-effort.
  })
}

/** @internal — dipakai test untuk isolasi antar kasus. */
export function __resetChatDraftsForTest(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
  memory.clear()
  hydrated.clear()
}
