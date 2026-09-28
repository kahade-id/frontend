/**
 * Kahade — draft komentar etalase per item (mega-batch FE-IMP-1, item 161).
 *
 * "seperti draft chat": pola identik lib/chat-drafts.ts —
 *   1. Memory Map (sinkron, sumber kebenaran utama) — selamat dari navigasi
 *      selama app hidup.
 *   2. Persist ringan ke SecureStore per kunci
 *      `showcaseCommentDraftKey(showcaseId)` — selamat dari restart app.
 *      Debounce 800 ms supaya tiap ketikan tidak menulis Keychain/Keystore.
 *
 * Dipakai komposer komentar layar detail (`app/showcase/[id].tsx`); sheet
 * komentar feed (components/ui/showcase-comments-sheet.tsx) sudah punya draft
 * per item dalam memori sejak E-05 (2026-09-24) dan tidak diubah di sini.
 *
 * Batasan yang disengaja (sama seperti draft chat):
 *   - > 1900 byte HANYA hidup di memory (batas nilai SecureStore ±2048 byte).
 *   - Di web persist jatuh ke memory proses (lihat `setRawItem`).
 *   - Draft TIDAK dihapus `clearSession()` (preferensi level perangkat).
 *   - Draft dihapus saat komentar TERKIRIM (`clearShowcaseCommentDraft`).
 */
import {
  deleteRawItem,
  getRawItem,
  setRawItem,
  showcaseCommentDraftKey,
} from "@/lib/secure-storage"

/** Jeda debounce tulis persist setelah ketikan terakhir (ms). */
export const SHOWCASE_COMMENT_DRAFT_PERSIST_DEBOUNCE_MS = 800
/** Batas aman byte per nilai SecureStore (2048), sisakan ruang. */
export const SHOWCASE_COMMENT_DRAFT_MAX_PERSIST_BYTES = 1900

const memory = new Map<string, string>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

function persist(showcaseId: string, text: string): void {
  const key = showcaseCommentDraftKey(showcaseId)
  if (text.length === 0) {
    void deleteRawItem(key).catch(() => {
      // Gagal hapus bukan fatal — memory tetap sumber kebenaran.
    })
    return
  }
  if (byteLength(text) > SHOWCASE_COMMENT_DRAFT_MAX_PERSIST_BYTES) {
    // Terlalu besar untuk satu nilai SecureStore: biarkan di memory saja.
    return
  }
  void setRawItem(key, text).catch(() => {
    // Gagal persist bukan fatal — memory tetap sumber kebenaran.
  })
}

/**
 * Baca sinkron dari memory (dipakai render awal). `undefined` bila belum
 * pernah disimpan sesi ini — pemanggil yang butuh nilai dari storage memakai
 * `loadShowcaseCommentDraft`.
 */
export function peekShowcaseCommentDraft(showcaseId: string): string | undefined {
  return memory.get(showcaseId)
}

/**
 * Simpan draft: memory ditulis SINKRON (sumber kebenaran), persist ke
 * SecureStore di-debounce. Aman dipanggil tiap `onChangeText`.
 */
export function saveShowcaseCommentDraft(showcaseId: string, text: string): void {
  memory.set(showcaseId, text)
  const existing = pendingTimers.get(showcaseId)
  if (existing) clearTimeout(existing)
  pendingTimers.set(
    showcaseId,
    setTimeout(() => {
      pendingTimers.delete(showcaseId)
      persist(showcaseId, text)
    }, SHOWCASE_COMMENT_DRAFT_PERSIST_DEBOUNCE_MS),
  )
}

/**
 * Muat draft dari storage ke memory (sekali per item). Mengembalikan teks
 * draft atau "" bila tidak ada.
 */
export async function loadShowcaseCommentDraft(showcaseId: string): Promise<string> {
  const inMemory = memory.get(showcaseId)
  if (inMemory !== undefined) return inMemory
  try {
    const stored = await getRawItem(showcaseCommentDraftKey(showcaseId))
    if (typeof stored === "string" && stored.length > 0) {
      memory.set(showcaseId, stored)
      return stored
    }
  } catch {
    // Bukan fatal — draft hilang, pengguna mengetik ulang.
  }
  return ""
}

/** Hapus draft (dipanggil setelah komentar TERKIRIM). */
export function clearShowcaseCommentDraft(showcaseId: string): void {
  memory.delete(showcaseId)
  const existing = pendingTimers.get(showcaseId)
  if (existing) {
    clearTimeout(existing)
    pendingTimers.delete(showcaseId)
  }
  void deleteRawItem(showcaseCommentDraftKey(showcaseId)).catch(() => {
    // Gagal hapus bukan fatal.
  })
}
