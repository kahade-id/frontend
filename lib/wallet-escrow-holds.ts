/**
 * Kahade — rincian dana ditahan escrow (FE-IMP-4 item 1).
 *
 * Murni (tanpa React): dari daftar mutasi dompet, hitung order mana yang
 * MASIH menahan dana. Satu order menahan dana bila ada mutasi ORDER_LOCK
 * dengan `referenceId` = id order, TANPA mutasi pelepasan (ORDER_RELEASE /
 * ORDER_REFUND / DISPUTE_RELEASE) ber-`referenceId` sama.
 *
 * Display-only / read-only: fungsi ini tidak mengubah saldo, limit, atau
 * eligibility apa pun — hanya mengelompokkan data server untuk ditampilkan
 * saat sub-baris "dalam transaksi" diketuk.
 */

import type { WalletTransaction } from "@/lib/api/wallet"

/** Jenis mutasi yang MELEPAS dana tertahan escrow. */
const RELEASE_TYPES: ReadonlySet<string> = new Set([
  "ORDER_RELEASE",
  "ORDER_REFUND",
  "DISPUTE_RELEASE",
])

export type EscrowHold = {
  /** Id order penahan (dari `referenceId` mutasi ORDER_LOCK). */
  orderId: string
  /** Nominal yang ditahan (abs, dari mutasi ORDER_LOCK). */
  amount: number
  /** Waktu penguncian (ISO) — untuk urutan & label. */
  lockedAt: string
}

/**
 * Hitung daftar order yang masih menahan dana, terurut terbaru dulu.
 * Mutasi tanpa `referenceId` atau tanpa nominal valid dilewati (defensif).
 */
export function computeEscrowHolds(transactions: WalletTransaction[]): EscrowHold[] {
  const released = new Set<string>()
  const locks = new Map<string, EscrowHold>()

  for (const tx of transactions) {
    const ref = tx.referenceId?.trim()
    if (!ref) continue
    const amount = Math.abs(tx.amount || 0)
    if (tx.type === "ORDER_LOCK") {
      if (!locks.has(ref) && amount > 0) {
        locks.set(ref, { orderId: ref, amount, lockedAt: tx.createdAt })
      }
    } else if (RELEASE_TYPES.has(tx.type)) {
      released.add(ref)
    }
  }

  return [...locks.values()]
    .filter((hold) => !released.has(hold.orderId))
    .sort((a, b) => (b.lockedAt < a.lockedAt ? -1 : b.lockedAt > a.lockedAt ? 1 : 0))
}

/** Total dana tertahan dari daftar hasil `computeEscrowHolds`. */
export function totalEscrowHeld(holds: EscrowHold[]): number {
  return holds.reduce((sum, hold) => sum + hold.amount, 0)
}
