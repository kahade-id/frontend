/**
 * Kahade — Journey (perjalanan) order.
 *
 * Pure function: menurunkan 5 tahap perjalanan order
 * (Dibuat → Dibayar ke escrow → Dikirim → Diterima → Dana cair)
 * dari data yang SUDAH ADA di layar detail order — tanpa fetch tambahan,
 * tanpa mengubah logika apa pun.
 *
 * Sumber timestamp (urutan prioritas):
 *   1. field langsung order (createdAt, paidAt, completedAt),
 *   2. entri riwayat pertama dengan toStatus yang cocok
 *      (riwayat backend terurut kronologis menaik).
 *
 * Status terminal non-normal (DISPUTED/CANCELLED/REFUNDED/EXPIRED)
 * menambahkan satu node penutup sebagai ganti sisa tahap yang tidak terjadi.
 */

/** Status langkah dalam perjalanan. */
export type JourneyStepState = "done" | "current" | "upcoming" | "failed"

/** Tone visual langkah — data murni, renderer yang memetakan ke warna. */
export type JourneyStepTone = "success" | "info" | "neutral" | "warning" | "danger"

export type JourneyStepKey =
  | "created"
  | "paid"
  | "shipped"
  | "received"
  | "released"
  | "disputed"
  | "cancelled"
  | "refunded"
  | "expired"

export type JourneyStep = {
  key: JourneyStepKey
  /** Label Indonesia, mis. "Dibayar ke escrow". */
  label: string
  /** Petunjuk singkat untuk langkah berjalan, mis. "Menunggu pembayaran pembeli". */
  hint?: string
  state: JourneyStepState
  tone: JourneyStepTone
  /** ISO timestamp kapan tahap terjadi; null bila belum terjadi. */
  timestamp: string | null
}

export type JourneyHistoryEntry = {
  toStatus: string
  createdAt: string
}

export type JourneyInput = {
  status: string
  /** Dibuat null-tolerant karena memo dipasang sebelum early-return order. */
  createdAt: string | null
  paidAt?: string | null
  completedAt?: string | null
  /** Terurut kronologis menaik (terlama dulu) — sesuai respons backend. */
  history: readonly JourneyHistoryEntry[]
}

const LABELS: Record<JourneyStepKey, string> = {
  created: "Order dibuat",
  paid: "Dibayar ke escrow",
  shipped: "Dikirim penjual",
  received: "Diterima pembeli",
  released: "Dana cair ke penjual",
  disputed: "Dalam sengketa",
  cancelled: "Order dibatalkan",
  refunded: "Dana dikembalikan",
  expired: "Order kedaluwarsa",
}

/** Status legacy yang mungkin muncul mentah di riwayat. */
const SHIPPED_STATUSES = ["IN_DELIVERY", "SHIPPED"]
const COMPLETED_STATUSES = ["COMPLETED", "DELIVERED"]

function firstTransition(
  history: readonly JourneyHistoryEntry[],
  statuses: readonly string[],
): string | null {
  for (const h of history) {
    if (statuses.includes(h.toStatus)) return h.createdAt
  }
  return null
}

function step(
  key: JourneyStepKey,
  state: JourneyStepState,
  timestamp: string | null,
  tone?: JourneyStepTone,
  hint?: string,
): JourneyStep {
  const defaultTone: JourneyStepTone =
    state === "done" ? "success" : state === "current" ? "info" : state === "failed" ? "danger" : "neutral"
  return { key, label: LABELS[key], state, tone: tone ?? defaultTone, timestamp, hint }
}

/**
 * Bangun langkah perjalanan order. Tidak pernah melempar untuk status tak
 * dikenal — status asing diperlakukan seperti WAITING_CONFIRMATION (tahap
 * awal) agar layar tetap informatif.
 */
export function buildOrderJourney(input: JourneyInput): JourneyStep[] {
  const { status, createdAt, history } = input
  const paidAt = input.paidAt ?? firstTransition(history, ["PROCESSING", "PAID"])
  const shippedAt = firstTransition(history, SHIPPED_STATUSES)
  const receivedAt = firstTransition(history, COMPLETED_STATUSES) ?? input.completedAt ?? null
  const releasedAt = input.completedAt ?? firstTransition(history, COMPLETED_STATUSES) ?? null

  const done = (key: JourneyStepKey, timestamp: string | null, tone?: JourneyStepTone) =>
    step(key, "done", timestamp, tone)
  const upcoming = (key: JourneyStepKey, hint?: string) => step(key, "upcoming", null, "neutral", hint)

  switch (status) {
    case "COMPLETED":
      return [
        done("created", createdAt),
        done("paid", paidAt),
        done("shipped", shippedAt),
        done("received", receivedAt),
        done("released", releasedAt),
      ]
    case "IN_DELIVERY":
    case "SHIPPED":
    case "DELIVERED":
      return [
        done("created", createdAt),
        done("paid", paidAt),
        done("shipped", shippedAt ?? null),
        step("received", "current", null, "info", "Menunggu konfirmasi penerimaan pembeli"),
        upcoming("released", "Dana diteruskan otomatis setelah konfirmasi"),
      ]
    case "PROCESSING":
    case "PAID":
      return [
        done("created", createdAt),
        done("paid", paidAt),
        step("shipped", "current", null, "info", "Menunggu penjual mengirim pesanan"),
        upcoming("received"),
        upcoming("released"),
      ]
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      return [
        done("created", createdAt),
        step("paid", "current", null, "info", "Menunggu pembayaran pembeli"),
        upcoming("shipped"),
        upcoming("received"),
        upcoming("released"),
      ]
    case "DISPUTED": {
      const disputedAt = firstTransition(history, ["DISPUTED"])
      return [
        done("created", createdAt),
        done("paid", paidAt),
        ...(shippedAt ? [done("shipped", shippedAt)] : [upcoming("shipped")]),
        upcoming("received"),
        upcoming("released"),
        step("disputed", "failed", disputedAt, "danger", "Dana escrow dibekukan sampai sengketa selesai"),
      ]
    }
    case "CANCELLED": {
      const cancelledAt = firstTransition(history, ["CANCELLED"])
      return [
        done("created", createdAt),
        ...(paidAt ? [done("paid", paidAt)] : []),
        step("cancelled", "failed", cancelledAt, "neutral", "Dana escrow dikembalikan ke pembeli"),
      ]
    }
    case "REFUNDED": {
      const refundedAt = firstTransition(history, ["REFUNDED"])
      return [
        done("created", createdAt),
        done("paid", paidAt),
        step("refunded", "failed", refundedAt, "neutral", "Dana sudah kembali ke pembeli"),
      ]
    }
    case "EXPIRED": {
      const expiredAt = firstTransition(history, ["EXPIRED"])
      return [
        done("created", createdAt),
        ...(paidAt ? [done("paid", paidAt)] : []),
        step("expired", "failed", expiredAt, "warning"),
      ]
    }
    case "WAITING_CONFIRMATION":
    default:
      return [
        done("created", createdAt),
        step("paid", "current", null, "info", "Menunggu penjual mengonfirmasi, lalu pembayaran"),
        upcoming("shipped"),
        upcoming("received"),
        upcoming("released"),
      ]
  }
}
