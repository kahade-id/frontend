/**
 * Kahade — antrean pesan live support yang gagal terkirim
 * (batch 139, item F07).
 *
 * Putus jaringan sebelumnya menghilangkan konteks: pesan optimistis yang
 * gagal langsung dibuang + toast. Sekarang pesan gagal MASUK ANTREAN lokal
 * (per akun, dihapus `clearSession()`), ditampilkan dengan status
 * "Belum terkirim" + tombol "Coba lagi" per pesan, dan ikut reconnect ke
 * sesi yang sama (ticketId tersimpan per entri).
 *
 * Di web memory-only (SecureKeys.liveSupportOutbox tidak masuk
 * WEB_PERSISTENT_KEYS).
 */
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

/** Maksimal pesan gagal yang dipertahankan (±50). */
export const OUTBOX_MAX = 50

export type UnsentLiveMessage = {
  /** id lokal stabil (dipakai sebagai key UI + dedupe). */
  id: string
  /** Sesi live support tempat pesan ini seharusnya terkirim. */
  ticketId: string
  text: string
  createdAt: number
  attempts: number
}

function sanitize(raw: unknown): UnsentLiveMessage[] {
  if (!Array.isArray(raw)) return []
  const out: UnsentLiveMessage[] = []
  for (const r of raw) {
    if (!r || typeof r !== "object") continue
    const rec = r as Record<string, unknown>
    const id = typeof rec.id === "string" ? rec.id : ""
    const ticketId = typeof rec.ticketId === "string" ? rec.ticketId : ""
    const text = typeof rec.text === "string" ? rec.text.slice(0, 2000) : ""
    if (!id || !ticketId || !text) continue
    out.push({
      id,
      ticketId,
      text,
      createdAt: typeof rec.createdAt === "number" && Number.isFinite(rec.createdAt) ? rec.createdAt : Date.now(),
      attempts: typeof rec.attempts === "number" && Number.isFinite(rec.attempts) ? Math.max(0, Math.floor(rec.attempts)) : 0,
    })
  }
  return out.slice(0, OUTBOX_MAX)
}

async function loadAll(): Promise<UnsentLiveMessage[]> {
  try {
    const raw = await getSecureItem(SecureKeys.liveSupportOutbox)
    if (!raw) return []
    return sanitize(JSON.parse(raw))
  } catch (err) {
    logWarn("live-support-outbox:load", err)
    return []
  }
}

async function saveAll(list: UnsentLiveMessage[]): Promise<void> {
  try {
    await setSecureItem(SecureKeys.liveSupportOutbox, JSON.stringify(list.slice(0, OUTBOX_MAX)))
  } catch (err) {
    logWarn("live-support-outbox:save", err)
  }
}

/** Pesan belum terkirim untuk sesi (ticketId) tertentu, terurut paling lama dulu. */
export async function getUnsentLiveMessages(ticketId: string): Promise<UnsentLiveMessage[]> {
  const all = await loadAll()
  return all
    .filter((m) => m.ticketId === ticketId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** Tambah pesan gagal (dedupe per id; attempts di-reset bila entri sudah ada). */
export async function enqueueUnsentLiveMessage(msg: Omit<UnsentLiveMessage, "attempts">): Promise<UnsentLiveMessage[]> {
  const all = await loadAll()
  const next = all.filter((m) => m.id !== msg.id)
  next.unshift({ ...msg, attempts: 0 })
  await saveAll(next)
  return next.filter((m) => m.ticketId === msg.ticketId)
}

/** Hapus entri setelah berhasil terkirim. */
export async function dequeueUnsentLiveMessage(id: string): Promise<void> {
  const all = await loadAll()
  await saveAll(all.filter((m) => m.id !== id))
}

/** Catat satu percobaan kirim ulang gagal (untuk label "percobaan ke-N"). */
export async function bumpUnsentAttempts(id: string): Promise<void> {
  const all = await loadAll()
  await saveAll(all.map((m) => (m.id === id ? { ...m, attempts: m.attempts + 1 } : m)))
}
