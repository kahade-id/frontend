/**
 * Kahade — Journey (perjalanan) order.
 *
 * Pure function: menurunkan 5 tahap perjalanan order
 * (Dibuat → Dibayar ke Kahade → Dikirim → Diterima → Dana cair)
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
  | "confirmed"
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
  /** Label Indonesia, mis. "Dibayar ke Kahade". */
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
  /**
   * TRX-014 (audit UI/UX 2026-09-28): jenis order untuk label tahap
   * "pengiriman" yang jujur. Order JASA/DIGITAL tidak punya konsep
   * pengiriman — tanpa ini journey menyuruh pembeli menunggu "Dikirim
   * penjual" yang tidak akan pernah ada. Opsional: bila tidak dikirim,
   * perilaku lama (fisik) dipertahankan.
   */
  orderType?: string | null
}

const LABELS: Record<JourneyStepKey, string> = {
  created: "Order dibuat",
  // FE-045: langkah eksplisit antara "dibuat" dan "dibayar" — pada tahap
  // ini BELUM ADA dana yang bergerak.
  confirmed: "Konfirmasi penjual",
  paid: "Dibayar ke Kahade",
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
 * TRX-014: label + hint tahap "pengiriman" per jenis order. Kunci langkah
 * tetap "shipped" (ikon/renderer tidak berubah) — hanya bahasanya yang
 * jujur untuk non-fisik.
 */
function shipmentCopy(orderType?: string | null): { label: string; currentHint: string } {
  switch ((orderType ?? "").toUpperCase()) {
    case "SERVICE":
      return { label: "Dikerjakan penjual", currentHint: "Penjual sedang mengerjakan pesanan" }
    case "DIGITAL_GOODS":
      return {
        label: "Disiapkan penjual",
        currentHint: "Menunggu penjual menyiapkan barang digital",
      }
    default:
      return { label: "Dikirim penjual", currentHint: "Menunggu penjual mengirim pesanan" }
  }
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

  // TRX-014: varian tahap pengiriman yang sadar jenis order.
  const shipment = shipmentCopy(input.orderType)
  const shippedDone = (timestamp: string | null, tone?: JourneyStepTone): JourneyStep => ({
    ...done("shipped", timestamp, tone),
    label: shipment.label,
  })
  const shippedCurrent = (): JourneyStep => ({
    ...step("shipped", "current", null, "info", shipment.currentHint),
    label: shipment.label,
  })
  const shippedUpcoming = (): JourneyStep => ({ ...upcoming("shipped"), label: shipment.label })

  switch (status) {
    case "COMPLETED":
      return [
        done("created", createdAt),
        done("paid", paidAt),
        shippedDone(shippedAt),
        done("received", receivedAt),
        done("released", releasedAt),
      ]
    case "IN_DELIVERY":
    case "SHIPPED":
    case "DELIVERED":
      return [
        done("created", createdAt),
        done("paid", paidAt),
        shippedDone(shippedAt ?? null),
        step("received", "current", null, "info", "Menunggu konfirmasi penerimaan pembeli"),
        upcoming("released", "Dana diteruskan otomatis setelah konfirmasi"),
      ]
    case "PROCESSING":
    case "PAID":
      return [
        done("created", createdAt),
        done("paid", paidAt),
        shippedCurrent(),
        upcoming("received"),
        upcoming("released"),
      ]
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      return [
        done("created", createdAt),
        step("paid", "current", null, "info", "Menunggu pembayaran pembeli"),
        shippedUpcoming(),
        upcoming("received"),
        upcoming("released"),
      ]
    case "DISPUTED": {
      const disputedAt = firstTransition(history, ["DISPUTED"])
      return [
        done("created", createdAt),
        done("paid", paidAt),
        ...(shippedAt ? [shippedDone(shippedAt)] : [shippedUpcoming()]),
        upcoming("received"),
        upcoming("released"),
        step("disputed", "failed", disputedAt, "danger", "Dana dibekukan sampai sengketa selesai"),
      ]
    }
    case "CANCELLED": {
      const cancelledAt = firstTransition(history, ["CANCELLED"])
      // TRX-013 (audit UI/UX 2026-09-28): jangan klaim "dana dikembalikan"
      // untuk order yang dibatalkan SEBELUM pembayaran — tidak ada dana
      // escrow yang pernah bergerak.
      const cancelledHint = paidAt
        ? "Dana dikembalikan ke pembeli"
        : "Order dibatalkan sebelum pembayaran — tidak ada dana yang sempat dibayarkan"
      return [
        done("created", createdAt),
        ...(paidAt ? [done("paid", paidAt)] : []),
        step("cancelled", "failed", cancelledAt, "neutral", cancelledHint),
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
      // FE-045: "Dibayar ke Kahade" TIDAK boleh jadi current — pada tahap
      // ini uang BELUM bergerak. Langkah "Konfirmasi penjual" yang current.
      return [
        done("created", createdAt),
        step("confirmed", "current", null, "info", "Menunggu penjual mengonfirmasi pesanan"),
        upcoming("paid"),
        shippedUpcoming(),
        upcoming("received"),
        upcoming("released"),
      ]
  }
}
