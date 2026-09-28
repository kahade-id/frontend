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
export type ShowcaseModerationStatus = "approved" | "pending" | "rejected" | "unknown"

export type ShowcaseModerationInfo = {
  status: ShowcaseModerationStatus
  /** Alasan penolakan/peninjauan dari server — tampilkan sebagai teks biasa. */
  reason?: string
  /** Waktu keputusan/peninjauan (ISO) bila ada. */
  reviewedAt?: string
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
  return info
}

/** True bila item butuh perhatian pemilik (ditinjau/ditolak). */
export function needsModerationAttention(info: ShowcaseModerationInfo): boolean {
  return info.status === "pending" || info.status === "rejected"
}
