/**
 * Kahade — status moderasi etalase untuk layar Kelola (C12, batch 139).
 *
 * Backend BELUM mengekspos field moderasi pada GET /v1/users/me/showcase
 * (per 2026-09-28): resolver membaca kandidat field secara defensif
 * (`moderationStatus`, `reviewStatus`, `moderationState`, …) sehingga UI
 * siap saat backend menambahkannya. Tanpa field itu status = "unknown"
 * (graceful: tidak ada label moderasi yang ditampilkan).
 *
 * "Alasan aman": alasan dari server ditampilkan sebagai TEKS BIASA (tanpa
 * render HTML) — tidak ada injeksi markup dari payload.
 */
/**
 * BE-1/BE-2 (audit etalase 2026-10-10): backend kini mengirim field
 * moderasi pemilik pada GET /v1/users/me/showcase & detail pemilik —
 * `moderationStatus` ("TAKEDOWN" | "RESTRICTED"), `moderationReason`,
 * `moderatedAt`, `moderationReportId`, `moderationUntil` (RESTRICTED).
 * "takedown"/"restricted" = TERKUNCI: ubah/aktifkan/jadwalkan ditolak 403
 * SHOWCASE_MODERATED oleh server sampai moderator memulihkan.
 */
export type ShowcaseModerationStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "takedown"
  | "restricted"
  | "unknown"

export type ShowcaseModerationInfo = {
  status: ShowcaseModerationStatus
  /** Alasan penolakan/peninjauan dari server — tampilkan sebagai teks biasa. */
  reason?: string
  /** Waktu keputusan/peninjauan (ISO) bila ada. */
  reviewedAt?: string
  /** RESTRICTED: batas waktu pembatasan (ISO) bila ada. */
  until?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

function pickString(rec: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return undefined
}

const STATUS_KEYS = ["moderationStatus", "reviewStatus", "moderationState", "status"] as const
const REASON_KEYS = [
  "moderationNote",
  "moderationReason",
  "rejectionReason",
  "reviewNote",
  "reviewReason",
] as const
const TIME_KEYS = ["moderatedAt", "reviewedAt", "moderationAt", "reviewAt"] as const
const UNTIL_KEYS = ["moderationUntil", "restrictedUntil"] as const

/** Normalisasi nilai status mentah → kosakata UI. */
export function normalizeModerationStatus(raw: unknown): ShowcaseModerationStatus {
  if (typeof raw !== "string") return "unknown"
  const v = raw.trim().toUpperCase()
  if (v === "APPROVED" || v === "PUBLISHED" || v === "ACTIVE" || v === "LIVE") return "approved"
  if (
    v === "PENDING" ||
    v === "IN_REVIEW" ||
    v === "UNDER_REVIEW" ||
    v === "REVIEW" ||
    v === "SUBMITTED"
  )
    return "pending"
  if (v === "REJECTED" || v === "REJECT" || v === "DECLINED" || v === "FAILED_REVIEW")
    return "rejected"
  // Enforcement moderasi aktif (ModerationEventAction backend).
  if (v === "TAKEDOWN" || v === "TAKEN_DOWN") return "takedown"
  if (v === "RESTRICTED") return "restricted"
  // RESTORED = enforcement dicabut → item normal kembali.
  if (v === "RESTORED") return "approved"
  return "unknown"
}

/** Resolve info moderasi dari item — murni, unit-testable. */
export function resolveShowcaseModeration(item: unknown): ShowcaseModerationInfo {
  const rec = asRecord(item)
  if (!rec) return { status: "unknown" }
  const status = normalizeModerationStatus(pickString(rec, STATUS_KEYS))
  if (status === "unknown") return { status: "unknown" }
  const info: ShowcaseModerationInfo = { status }
  const reason = pickString(rec, REASON_KEYS)
  if (reason) info.reason = reason
  const reviewedAt = pickString(rec, TIME_KEYS)
  if (reviewedAt) info.reviewedAt = reviewedAt
  const until = pickString(rec, UNTIL_KEYS)
  if (until) info.until = until
  return info
}

/** True bila item butuh perhatian pemilik (ditinjau/ditolak/ditindak). */
export function needsModerationAttention(info: ShowcaseModerationInfo): boolean {
  return (
    info.status === "pending" ||
    info.status === "rejected" ||
    info.status === "takedown" ||
    info.status === "restricted"
  )
}

/**
 * True bila server menolak perubahan (403 SHOWCASE_MODERATED): item sedang
 * di-takedown / dibatasi. UI menyembunyikan aksi ubah/aktifkan/foto agar
 * pengguna tidak menabrak dinding 403 berulang.
 */
export function isModerationLocked(info: ShowcaseModerationInfo): boolean {
  return info.status === "takedown" || info.status === "restricted"
}
