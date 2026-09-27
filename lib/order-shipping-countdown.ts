/**
 * Kahade — countdown "Batas waktu kirim penjual" di detail order.
 *
 * Logika tampil/sembunyi MURNI (tanpa React, tanpa tick) agar bisa dikunci
 * test unit: diberi snapshot order + jam sekarang (ms), mengembalikan kartu
 * yang harus tampil atau `null` bila tidak ada yang boleh tampil.
 *
 * Aturan (kontrak dengan backend GET /v1/orders/:id):
 * - Tampil countdown HANYA bila: order sudah dibayar & belum dikirim
 *   (`shippedBy` null) & `shippingDeadline` ada & masih di masa depan.
 * - Sudah dikirim (`shippedBy` ada) → tidak tampil.
 * - Deadline lewat → kartu TETAP tampil dengan status jujur ("melewati
 *   batas"), bukan disembunyikan diam-diam. Pola ini konsisten dengan
 *   countdown auto-release dana yang saat habis menampilkan teks alternatif
 *   ("Dana akan segera diteruskan ke penjual.") alih-alih hilang.
 * - Fail closed: `shippingDeadline` null/invalid → `null`, tidak crash.
 *
 * Jam perbandingan diserahkan pemanggil (layar memakai `nowMs` dari
 * `useClockTick`, yang berakar di `serverNow()` — perangkat dengan jam
 * meleset tidak melihat hitungan yang salah, F-13).
 */
import type { OrderStatus } from "@/lib/api/orders-shared"

export type ShippingCountdown =
  | { kind: "countdown"; at: string; secondsLeft: number }
  | { kind: "overdue"; at: string }

/** Status di mana dana pembeli sudah masuk escrow — countdown kirim relevan. */
const PAID_STATUSES: ReadonlySet<string> = new Set([
  "PROCESSING",
  "IN_DELIVERY",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "DISPUTED",
])

export type ShippingCountdownInput = {
  status: OrderStatus
  paidAt?: string | null
  shippingDeadline?: string | null
  shippedBy?: string | null
}

export function resolveShippingCountdown(
  order: ShippingCountdownInput | null | undefined,
  nowMs: number,
): ShippingCountdown | null {
  if (!order) return null
  // Sudah dikirim (shippedBy = shippedAt) → countdown tidak relevan.
  if (order.shippedBy) return null
  // Belum dibayar → belum ada kewajiban kirim yang perlu dihitung mundur.
  // `paidAt` penanda utama (A-03); status pasca-bayar sebagai jaring pengaman
  // untuk payload legacy yang menghilangkan paidAt.
  const paid = !!order.paidAt || PAID_STATUSES.has(order.status)
  if (!paid) return null
  // Fail closed: deadline hilang / bukan string parseable → tidak tampil.
  const raw = order.shippingDeadline
  if (raw == null) return null
  const target = new Date(raw).getTime()
  if (!Number.isFinite(target)) return null
  if (target > nowMs) {
    return { kind: "countdown", at: raw, secondsLeft: Math.floor((target - nowMs) / 1000) }
  }
  // Deadline lewat: status jujur, bukan sembunyi (lihat header file).
  return { kind: "overdue", at: raw }
}
