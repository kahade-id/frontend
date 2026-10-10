/**
 * Kahade — label kehadiran lawan bicara yang TIDAK menyesatkan (B11).
 *
 * Masalah: "Online" / "Terakhir dilihat …" dirender apa adanya dari respons
 * `GET /rooms/{id}/presence`. Bila respons itu basi (diambil semenit lalu
 * lalu jaringan putus, atau poll gagal diam-diam), labelnya terlihat pasti
 * padahal datanya sudah kedaluwarsa.
 *
 * Aturan di sini (murni, tanpa render):
 *   - Data presence dicap `fetchedAt` (waktu klien menerima respons).
 *   - `isOnline=true` hanya dipercaya selama `PRESENCE_ONLINE_STALE_MS`
 *     (60 dtk) sejak fetchedAt — lewat dari itu label jatuh ke fallback
 *     netral, BUKAN "Offline" (yang juga klaim kepastian).
 *   - `lastSeenAt` yang lebih tua dari `PRESENCE_LAST_SEEN_STALE_MS`
 *     (5 menit) tidak lagi disebut waktu spesifik — fallback netral.
 *   - `presence=null` (belum termuat / fetch gagal) → fallback netral juga:
 *     baris status tidak boleh mengklaim apa pun dari ketiadaan data.
 */

export type PresenceInput = {
  isOnline: boolean
  lastSeenAt?: string | null
} | null

/** Bentuk presence yang disimpan layar (cermin `ChatPresence` lib/api/chat). */
export type PresenceRecord = {
  roomId: string
  userId: string | null
  isOnline: boolean
  lastSeenAt?: string | null
}

/**
 * Audit Pesan 2026-10-10 (#9b): terapkan event realtime `user.online` /
 * `user.offline` ke state presence.
 *
 * Dulu: `setPresence(prev => prev ? { ...prev, isOnline } : prev)` — dua
 * cacat:
 *   1. `prev === null` (GET presence awal gagal/belum tiba) → event dibuang,
 *      baris status kosong walau socket baru saja bilang "online".
 *   2. `fetchedAt` tidak dicap ulang, sedangkan saat realtime sehat polling
 *      REST dimatikan → 60 dtk setelah GET terakhir label jatuh ke "stale"
 *      (kosong) PADAHAL socket hidup dan tidak mengirim offline.
 * Pemanggil WAJIB mencap `fetchedAt = now` bersamaan dengan hasil ini.
 *
 * Offline → `lastSeenAt = now`: event offline adalah momen terakhir terlihat
 * yang paling akurat yang kita punya; online → pertahankan lastSeenAt lama.
 */
export function applyPresenceEvent(
  prev: PresenceRecord | null,
  isOnline: boolean,
  ctx: { roomId: string; nowIso: string },
): PresenceRecord {
  return {
    roomId: prev?.roomId ?? ctx.roomId,
    userId: prev?.userId ?? null,
    isOnline,
    lastSeenAt: isOnline ? (prev?.lastSeenAt ?? null) : ctx.nowIso,
  }
}

/** "Online" kedaluwarsa setelah 60 detik tanpa refresh. */
export const PRESENCE_ONLINE_STALE_MS = 60_000
/** "Terakhir dilihat …" tidak disebut spesifik bila lebih tua dari 5 menit. */
export const PRESENCE_LAST_SEEN_STALE_MS = 5 * 60_000

export type PresenceLabel =
  | { kind: "online" }
  | { kind: "last-seen"; at: string }
  | { kind: "offline" }
  | { kind: "stale" }

/**
 * Hitung label kehadiran. `fetchedAtMs` = kapan respons presence diterima
 * klien; `nowMs` bisa disuntik test.
 */
export function presenceLabel(
  presence: PresenceInput,
  fetchedAtMs: number | null,
  nowMs: number = Date.now(),
): PresenceLabel {
  if (presence == null || fetchedAtMs == null || !Number.isFinite(fetchedAtMs)) {
    return { kind: "stale" }
  }
  const ageMs = nowMs - fetchedAtMs
  if (presence.isOnline) {
    // Online yang datanya basi = menyesatkan → netral.
    if (ageMs > PRESENCE_ONLINE_STALE_MS) return { kind: "stale" }
    return { kind: "online" }
  }
  const lastSeen = presence.lastSeenAt ? new Date(presence.lastSeenAt).getTime() : NaN
  if (Number.isFinite(lastSeen)) {
    if (nowMs - lastSeen > PRESENCE_LAST_SEEN_STALE_MS) return { kind: "stale" }
    return { kind: "last-seen", at: presence.lastSeenAt as string }
  }
  return { kind: "offline" }
}
