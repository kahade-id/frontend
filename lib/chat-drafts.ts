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
 * P2-C2 (audit back-flow 2026-10-03): selain teks, draft menyimpan
 * `replyToId` — id pesan yang sedang dibalas. Sebelumnya teks pulih tetapi
 * konteks reply hilang, sehingga pesan bisa terkirim TANPA balasan tanpa
 * disadari user. Kini reply target ikut dipulihkan (di-resolve ke objek
 * pesan setelah pesan dimuat); bila pesannya sudah tidak ada, konteks reply
 * dibuang dan composer tidak menampilkan chip — user sadar sebelum kirim.
 *
 * Format persist: JSON `{"t": teks, "r": replyToId|null}`. Nilai lama
 * (string mentah, sebelum P2-C2) tetap dibaca sebagai teks tanpa reply.
 *
 * Batasan yang disengaja:
 *   - SecureStore membatasi ±2048 byte per nilai. Draft > 1900 byte HANYA
 *     hidup di memory (tidak dipersist) — memotong diam-diam lebih buruk
 *     daripada draft yang hilang saat restart. Draft chat normal (≤2000
 *     karakter, CHAT_MESSAGE_MAX) hampir selalu muat.
 *   - Di web persist jatuh ke memory proses (lihat `setRawItem`) — isi chat
 *     tidak boleh mendarat di localStorage.
 *   - PERF-FIX (state audit): draft di-memory DIHAPUS saat sesi berganti
 *     (logout/login) — mencegah kebocoran ketikan antar-akun di perangkat
 *     yang sama. Persist SecureStore per-room tetap ada (bukan per-akun).
 *   - Draft dihapus saat pesan TERKIRIM (`clearChatDraft`), bukan saat layar
 *     ditutup — menutup room di tengah mengetik lalu kembali = draft kembali.
 *   - `subscribeChatDrafts`: daftar chat menampilkan "Draf: …" (pola
 *     WhatsApp/Telegram) dari memory — draft yang masih di storage dan belum
 *     pernah dibuka sesi ini belum terlihat di daftar sampai room-nya dibuka.
 */
import {
  chatDraftKey,
  deleteRawItem,
  getChatLocalScope,
  getRawItem,
  registerChatLocalKey,
  setRawItem,
} from "@/lib/secure-storage"
import { getSessionRevision, subscribeSession } from "@/lib/api/session"

/**
 * Audit Pesan 2026-10-10 (#6): kunci persist ber-scope SESI AKUN
 * (`getChatLocalScope`) dan tercatat di indeks supaya `clearSession()` bisa
 * menghapusnya saat logout. Sebelumnya kunci hanya per roomId: akun B di
 * perangkat yang sama memulihkan draft akun A, dan draft bertahan di
 * Keychain/Keystore setelah logout.
 */
export async function chatDraftStorageKey(roomId: string): Promise<string> {
  return chatDraftKey(roomId, await getChatLocalScope())
}

/** Jeda debounce tulis persist setelah ketikan terakhir (ms). */
export const CHAT_DRAFT_PERSIST_DEBOUNCE_MS = 800
/** Batas aman byte per nilai SecureStore (2048), sisakan ruang. */
export const CHAT_DRAFT_MAX_PERSIST_BYTES = 1900

/** Nilai draft per room: teks + konteks balasan. */
export type ChatDraft = {
  text: string
  /** id pesan yang dibalas — null bila bukan reply. */
  replyToId: string | null
}

const EMPTY_DRAFT: ChatDraft = { text: "", replyToId: null }

const memory = new Map<string, ChatDraft>()
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
/**
 * Pelanggan perubahan draft (daftar chat menampilkan "Draf: …" ala
 * WhatsApp/Telegram). Dipanggil setiap memory berubah — save/clear/hydrate.
 */
const listeners = new Set<() => void>()

function notifyDraftListeners(): void {
  for (const fn of listeners) fn()
}

/**
 * Berlangganan perubahan draft (semua room). Mengembalikan fungsi unsubscribe.
 * Hanya memory yang diamati: draft yang masih di SecureStore (belum pernah
 * dibuka sesi ini) baru terlihat setelah `loadChatDraft` room itu dipanggil.
 */
export function subscribeChatDrafts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
/** roomId yang sudah dimuat dari storage ke memory sesi ini. */
const hydrated = new Set<string>()

/**
 * PERF-FIX (state audit): bersihkan draft saat sesi berganti (logout/login).
 * Draft menahan isi ketikan per room di memori proses — tanpa reset, akun B
 * yang login di perangkat yang sama dapat melihat sisa draft akun A
 * (kebocoran data antar-sesi + pertumbuhan memori tak terbatas).
 */
let draftSessionRevision = getSessionRevision()
subscribeSession(() => {
  if (draftSessionRevision === getSessionRevision()) return
  draftSessionRevision = getSessionRevision()
  __resetChatDraftsForTest()
})

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

function serialize(draft: ChatDraft): string {
  return JSON.stringify({ t: draft.text, r: draft.replyToId })
}

/**
 * Parse nilai persist. Menerima format JSON baru; nilai lama berupa string
 * mentah (pra-P2-C2) diperlakukan sebagai teks tanpa reply — bukan error.
 */
function parseStored(stored: string): ChatDraft {
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

function persist(roomId: string, draft: ChatDraft): void {
  void (async () => {
    const key = await chatDraftStorageKey(roomId)
    if (draft.text.length === 0 && !draft.replyToId) {
      await deleteRawItem(key)
      return
    }
    if (byteLength(draft.text) > CHAT_DRAFT_MAX_PERSIST_BYTES) {
      // Terlalu besar untuk satu nilai SecureStore: biarkan di memory saja.
      return
    }
    // #6: catat di indeks DULU supaya logout selalu tahu kunci ini ada.
    await registerChatLocalKey(key)
    await setRawItem(key, serialize(draft))
  })().catch(() => {
    // Gagal persist/hapus bukan fatal — memory tetap sumber kebenaran.
  })
}

function schedulePersist(roomId: string, draft: ChatDraft): void {
  const prev = pendingTimers.get(roomId)
  if (prev) clearTimeout(prev)
  pendingTimers.set(
    roomId,
    setTimeout(() => {
      pendingTimers.delete(roomId)
      persist(roomId, draft)
    }, CHAT_DRAFT_PERSIST_DEBOUNCE_MS),
  )
}

/**
 * Baca sinkron dari memory (dipakai render awal / hot path ketikan).
 * Mengembalikan `undefined` bila belum pernah disimpan sesi ini — pemanggil
 * yang butuh nilai dari storage memakai `loadChatDraft`.
 */
export function peekChatDraft(roomId: string): ChatDraft | undefined {
  return memory.get(roomId)
}

/**
 * Simpan draft: memory ditulis SINKRON (sumber kebenaran), persist ke
 * SecureStore di-debounce. Aman dipanggil tiap `onChangeText`.
 *
 * `replyToId` yang `undefined` = pertahankan nilai yang sudah ada (mengetik
 * tidak boleh menghapus konteks reply); `null`/string = set eksplisit.
 */
export function saveChatDraft(roomId: string, text: string, replyToId?: string | null): void {
  if (!roomId) return
  const prev = memory.get(roomId)
  const draft: ChatDraft = {
    text,
    replyToId: replyToId === undefined ? (prev?.replyToId ?? null) : replyToId,
  }
  memory.set(roomId, draft)
  hydrated.add(roomId)
  schedulePersist(roomId, draft)
  if ((prev?.text ?? "") !== text) notifyDraftListeners()
}

/**
 * P2-C2: perbarui HANYA konteks reply draft (dipanggil saat target balasan
 * berubah/dibatalkan), tanpa menyentuh teks.
 */
export function setChatDraftReply(roomId: string, replyToId: string | null): void {
  if (!roomId) return
  const prev = memory.get(roomId) ?? EMPTY_DRAFT
  if (prev.replyToId === replyToId) return
  const draft: ChatDraft = { text: prev.text, replyToId }
  memory.set(roomId, draft)
  hydrated.add(roomId)
  schedulePersist(roomId, draft)
}

/**
 * Muat draft room: memory dulu, lalu SecureStore bila belum di-hydrate sesi
 * ini. Dipakai sekali saat room dibuka. Mengembalikan `null` bila tidak ada
 * draft tersimpan.
 */
export async function loadChatDraft(roomId: string): Promise<ChatDraft | null> {
  if (!roomId) return null
  const cached = memory.get(roomId)
  if (cached !== undefined) return cached
  if (hydrated.has(roomId)) return null
  hydrated.add(roomId)
  try {
    const stored = await getRawItem(await chatDraftStorageKey(roomId))
    if (!stored) return null
    const draft = parseStored(stored)
    memory.set(roomId, draft)
    if (draft.text) notifyDraftListeners()
    return draft
  } catch {
    return null
  }
}

/**
 * Hapus draft: dipanggil setelah pesan TERKIRIM. Memory + storage dihapus
 * segera (tidak menunggu debounce — timer yang menggantung dibatalkan).
 */
export function clearChatDraft(roomId: string): void {
  if (!roomId) return
  const hadText = !!memory.get(roomId)?.text
  memory.delete(roomId)
  hydrated.add(roomId)
  if (hadText) notifyDraftListeners()
  const prev = pendingTimers.get(roomId)
  if (prev) {
    clearTimeout(prev)
    pendingTimers.delete(roomId)
  }
  void chatDraftStorageKey(roomId)
    .then((key) => deleteRawItem(key))
    .catch(() => {
      // Best-effort.
    })
}

/** @internal — dipakai test untuk isolasi antar kasus. */
export function __resetChatDraftsForTest(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer)
  pendingTimers.clear()
  memory.clear()
  hydrated.clear()
  listeners.clear()
}
