/**
 * Kahade — pesan sementara (ephemeral) & sekali-lihat (batch 43 FE-CHAT).
 *
 * Murni (tanpa RN) — bisa di-unit-test di Node.
 *
 * Kontrak backend: `ephemeralTtlSeconds` 5–604800 detik; `expiresAt` ISO;
 * pesan dihapus permanen oleh worker purge. `viewOnce` ditandai konsumsi
 * saat GET /messages — catatan: semantik "baru dianggap dibaca setelah
 * diketuk" BELUM didukung backend (lihat handoff batch 43).
 */

export type EphemeralDurationOption = {
  /** Detik. 0 = pesan sementara mati. */
  seconds: number
  label: string
}

/** Pilihan durasi yang diizinkan backend (5 dtk – 7 hari). */
export const EPHEMERAL_DURATION_OPTIONS: EphemeralDurationOption[] = [
  { seconds: 0, label: "Mati" },
  { seconds: 300, label: "5 menit" },
  { seconds: 3600, label: "1 jam" },
  { seconds: 86400, label: "1 hari" },
  { seconds: 604800, label: "7 hari" },
]

/** Label durasi untuk nilai detik arbitrer (fallback "N detik"). */
export function ephemeralDurationLabel(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "Mati"
  const hit = EPHEMERAL_DURATION_OPTIONS.find((o) => o.seconds === seconds)
  if (hit) return hit.label
  if (seconds < 60) return `${seconds} detik`
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} jam`
  return `${Math.round(seconds / 86400)} hari`
}

/** True bila pesan sudah melewati expiresAt. */
export function isMessageExpired(
  message: { expiresAt?: string | null } | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const at = message?.expiresAt
  if (!at) return false
  const t = Date.parse(at)
  return Number.isFinite(t) && t <= nowMs
}

/**
 * Label hitung mundur ringkas menuju expiresAt, mis. "59 mnt", "23 jam",
 * "6 hari". Mengembalikan null bila tidak ada expiresAt / sudah lewat.
 */
export function ephemeralCountdownLabel(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!expiresAt) return null
  const t = Date.parse(expiresAt)
  if (!Number.isFinite(t)) return null
  const diff = t - nowMs
  if (diff <= 0) return null
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "segera"
  if (minutes < 60) return `${minutes} mnt`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam`
  const days = Math.floor(hours / 24)
  return `${days} hari`
}

/** True bila pesan adalah pesan sekali-lihat. */
export function isViewOnceMessage(message: { viewOnce?: boolean } | null | undefined): boolean {
  return message?.viewOnce === true
}

/** True bila pesan sekali-lihat sudah dikonsumsi (viewOnceViewedAt terisi). */
export function isViewOnceConsumed(
  message: { viewOnceViewedAt?: string | null } | null | undefined,
): boolean {
  return !!message?.viewOnceViewedAt
}
