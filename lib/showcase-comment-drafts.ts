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
 * B2-SC-06 (audit back-flow batch 2): selain teks, draft menyimpan
 * `replyToId` — id komentar yang sedang dibalas. Sebelumnya teks pulih
 * tetapi konteks reply hilang, sehingga komentar bisa terkirim sebagai
 * top-level tanpa disadari. Kini reply target ikut dipulihkan; bila komentar
 * target tak ditemukan, chip balasan tidak tampil (user sadar sebelum kirim).
 *
 * Format persist: JSON `{"t": teks, "r": replyToId|null}`. Nilai lama
 * (string mentah) tetap dibaca sebagai teks tanpa reply.
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

/** Nilai draft komentar per item: teks + konteks balasan. */
export type ShowcaseCommentDraft = {
  text: string
  /** id komentar yang dibalas — null bila bukan reply. */
  replyToId: string | null
}

const EMPTY_DRAFT: ShowcaseCommentDraft = { text: "", replyToId: null }

const memory = new Map<string, ShowcaseCommentDraft>()
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

function serialize(draft: ShowcaseCommentDraft): string {
  return JSON.stringify({ t: draft.text, r: draft.replyToId })
}

/**
 * Parse nilai persist. Menerima format JSON baru; nilai lama berupa string
 * mentah diperlakukan sebagai teks tanpa reply — bukan error.
 */
function parseStored(stored: string): ShowcaseCommentDraft {
  if (stored.charCodeAt(0) === 0x7b /* "{" */) {
    try {
      const parsed = JSON.parse(stored) as { t?: unknown; r?: unknown }
      if (parsed && typeof parsed.t === "string") {
        return {
          text: parsed.t,
          replyToId: typeof parsed.r === "string" && parsed.r ? parsed.r : null,
        }
      }
    } catch {
      // Jatuh ke fallback legacy di bawah.
    }
  }
  return { text: stored, replyToId: null }
}

function persist(showcaseId: string, draft: ShowcaseCommentDraft): void {
  const key = showcaseCommentDraftKey(showcaseId)
  if (draft.text.length === 0 && !draft.replyToId) {
    void deleteRawItem(key).catch(() => {
      // Gagal hapus bukan fatal — memory tetap sumber kebenaran.
    })
    return
  }
  if (byteLength(draft.text) > SHOWCASE_COMMENT_DRAFT_MAX_PERSIST_BYTES) {
    // Terlalu besar untuk satu nilai SecureStore: biarkan di memory saja.
    return
  }
  void setRawItem(key, serialize(draft)).catch(() => {
    // Gagal persist bukan fatal — memory tetap sumber kebenaran.
  })
}

function schedulePersist(showcaseId: string, draft: ShowcaseCommentDraft): void {
  const existing = pendingTimers.get(showcaseId)
  if (existing) clearTimeout(existing)
  pendingTimers.set(
    showcaseId,
    setTimeout(() => {
      pendingTimers.delete(showcaseId)
      persist(showcaseId, draft)
    }, SHOWCASE_COMMENT_DRAFT_PERSIST_DEBOUNCE_MS),
  )
}

/**
 * Baca sinkron dari memory (dipakai render awal). `undefined` bila belum
 * pernah disimpan sesi ini — pemanggil yang butuh nilai dari storage memakai
 * `loadShowcaseCommentDraft`.
 */
export function peekShowcaseCommentDraft(showcaseId: string): ShowcaseCommentDraft | undefined {
  return memory.get(showcaseId)
}

/**
 * Simpan draft: memory ditulis SINKRON (sumber kebenaran), persist ke
 * SecureStore di-debounce. Aman dipanggil tiap `onChangeText`.
 *
 * `replyToId` yang `undefined` = pertahankan nilai yang sudah ada (mengetik
 * tidak boleh menghapus konteks reply); `null`/string = set eksplisit.
 */
export function saveShowcaseCommentDraft(
  showcaseId: string,
  text: string,
  replyToId?: string | null,
): void {
  if (!showcaseId) return
  const prev = memory.get(showcaseId)
  const draft: ShowcaseCommentDraft = {
    text,
    replyToId: replyToId === undefined ? (prev?.replyToId ?? null) : replyToId,
  }
  memory.set(showcaseId, draft)
  schedulePersist(showcaseId, draft)
}

/**
 * B2-SC-06: perbarui HANYA konteks reply draft (dipanggil saat target
 * balasan berubah/dibatalkan), tanpa menyentuh teks.
 */
export function setShowcaseCommentDraftReply(showcaseId: string, replyToId: string | null): void {
  if (!showcaseId) return
  const prev = memory.get(showcaseId) ?? EMPTY_DRAFT
  if (prev.replyToId === replyToId) return
  const draft: ShowcaseCommentDraft = { text: prev.text, replyToId }
  memory.set(showcaseId, draft)
  schedulePersist(showcaseId, draft)
}

/**
 * Muat draft dari storage ke memory (sekali per item). Mengembalikan
 * `null` bila tidak ada draft tersimpan.
 */
export async function loadShowcaseCommentDraft(
  showcaseId: string,
): Promise<ShowcaseCommentDraft | null> {
  if (!showcaseId) return null
  const inMemory = memory.get(showcaseId)
  if (inMemory !== undefined) return inMemory
  try {
    const stored = await getRawItem(showcaseCommentDraftKey(showcaseId))
    if (typeof stored === "string" && stored.length > 0) {
      const draft = parseStored(stored)
      memory.set(showcaseId, draft)
      return draft
    }
  } catch {
    // Bukan fatal — draft hilang, pengguna mengetik ulang.
  }
  return null
}

/** Hapus draft (dipanggil setelah komentar TERKIRIM). */
export function clearShowcaseCommentDraft(showcaseId: string): void {
  if (!showcaseId) return
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

/** @internal — dipakai test untuk isolasi antar kasus. */
export function __resetShowcaseCommentDraftsForTest(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
  memory.clear()
}
