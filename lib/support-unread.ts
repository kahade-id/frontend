/**
 * Kahade — penanda "belum dibaca" tiket dukungan (item mega-batch 126).
 *
 * Backend tidak punya flag unread per tiket, jadi aplikasi menyimpan
 * timestamp terakhir tiket DIBUKA secara lokal: tiket dianggap belum dibaca
 * bila aktivitas terakhirnya (updatedAt / pesan terbaru) lebih baru dari
 * waktu buka yang tersimpan.
 *
 * Penyimpanan di secure storage (kunci `SecureKeys.supportOpenedAt`) dan
 * DIHAPUS saat logout lewat `clearSession()` — data milik akun, bukan
 * preferensi perangkat. Di web secure storage = memory-only (sesi saja).
 */
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import { serverNow } from "@/lib/server-time"

/** Batas entri agar peta tidak tumbuh tanpa batas (±200 tiket terakhir). */
const MAX_ENTRIES = 200

type OpenedMap = Record<string, number>

function sanitize(raw: unknown): OpenedMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: OpenedMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && k.length > 0 && k.length <= 128 && typeof v === "number" && Number.isFinite(v)) {
      out[k] = v
    }
  }
  return out
}

export async function getSupportOpenedAt(): Promise<OpenedMap> {
  try {
    const raw = await getSecureItem(SecureKeys.supportOpenedAt)
    if (!raw) return {}
    return sanitize(JSON.parse(raw))
  } catch (err) {
    logWarn("support-unread:load", err)
    return {}
  }
}

/**
 * Catat tiket dibuka (sekarang, atau `openedAt` eksplisit untuk test).
 * Entri terlama dibuang bila melebihi MAX_ENTRIES.
 */
export async function markSupportTicketOpened(ticketId: string, openedAt?: number): Promise<void> {
  if (!ticketId) return
  try {
    const map = await getSupportOpenedAt()
    map[ticketId] = openedAt ?? serverNow()
    const keys = Object.keys(map)
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => map[a] - map[b])
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => {
          delete map[k]
        })
    }
    await setSecureItem(SecureKeys.supportOpenedAt, JSON.stringify(map))
  } catch (err) {
    // Gagal mencatat "dibuka" tidak boleh mengganggu baca tiket — badge
    // unread mungkin tertinggal, tapi bukan error yang perlu dilempar.
    logWarn("support-unread:save", err)
  }
}

/** Epoch ms aktivitas terakhir tiket (pesan terbaru > updatedAt > 0). */
export function supportTicketActivityMs(ticket: {
  updatedAt?: string | null
  messages?: Array<{ createdAt?: string | null }> | null
}): number {
  const stamps: number[] = []
  const push = (iso?: string | null) => {
    if (!iso) return
    const ms = new Date(iso).getTime()
    if (Number.isFinite(ms)) stamps.push(ms)
  }
  push(ticket.updatedAt)
  for (const m of ticket.messages ?? []) push(m?.createdAt)
  return stamps.length ? Math.max(...stamps) : 0
}

/**
 * true bila ada aktivitas lebih baru dari terakhir dibuka. Belum pernah
 * dibuka (`openedAt` tak ada) = belum dibaca — konsisten dengan pola "dot
 * untuk yang belum dilihat".
 */
export function isSupportTicketUnread(
  ticket: { id: string; updatedAt?: string | null; messages?: Array<{ createdAt?: string | null }> | null },
  openedAt: OpenedMap,
): boolean {
  const lastOpened = openedAt[ticket.id] ?? 0
  return supportTicketActivityMs(ticket) > lastOpened
}
