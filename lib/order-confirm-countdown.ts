/**
 * Kahade — countdown "Batas konfirmasi penjual" di detail order (FE-110).
 *
 * Logika tampil/sembunyi MURNI (tanpa React, tanpa tick) agar bisa dikunci
 * test unit: diberi snapshot order + jam sekarang (ms), mengembalikan kartu
 * yang harus tampil atau `null` bila tidak ada yang boleh tampil.
 *
 * Aturan (kontrak dengan backend GET /v1/orders/:id):
 * - Tampil HANYA bila status = WAITING_CONFIRMATION & `confirmationDeadlineAt`
 *   ada (field diekspos backend; di-set saat order dibuat = 2 hari).
 * - Deadline lewat → kartu TETAP tampil dengan status jujur ("melewati
 *   batas") — backend (ExpireUnconfirmedOrdersService) membatalkan order
 *   lewat tenggat; klien tidak berasumsi, hanya menampilkan status.
 * - Fail closed: deadline null/invalid → `null`, tidak crash.
 *
 * Pola mengikuti lib/order-shipping-countdown.ts.
 */
import type { OrderStatus } from "@/lib/api/orders-shared"

export type ConfirmCountdown =
  | { kind: "countdown"; at: string; secondsLeft: number }
  | { kind: "overdue"; at: string }

export type ConfirmCountdownInput = {
  status: OrderStatus
  confirmationDeadlineAt?: string | null
}

export function resolveConfirmCountdown(
  order: ConfirmCountdownInput | null | undefined,
  nowMs: number,
): ConfirmCountdown | null {
  if (!order) return null
  if (order.status !== "WAITING_CONFIRMATION") return null
  const raw = order.confirmationDeadlineAt
  if (raw == null) return null
  const target = new Date(raw).getTime()
  if (!Number.isFinite(target)) return null
  const secondsLeft = Math.floor((target - nowMs) / 1000)
  if (secondsLeft > 0) return { kind: "countdown", at: raw, secondsLeft }
  return { kind: "overdue", at: raw }
}
