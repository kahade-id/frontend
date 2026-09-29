/**
 * Kahade — istilah baku tunggal untuk dana yang ditahan di escrow (FE-004).
 *
 * Satu konsep ini sebelumnya dijelaskan dengan empat istilah berbeda di
 * wallet ("uang jaminan", "dana terkunci", "menahan dana", "jaminan
 * transaksi") — user bisa mengira ini empat hal berbeda. Aturan minimalisme
 * §9.1: satu istilah baku per konsep + satu kalimat penjelasan yang dipakai
 * ulang di semua tempat (hero wallet, sheet rincian saldo, sheet holds).
 */

/** Istilah baku untuk dana yang ditahan — satu-satunya yang dipakai di app. */
export const ESCROW_HELD_LABEL = "Ditahan di escrow"

/**
 * Satu kalimat penjelasan yang dipakai ulang di semua tempat.
 * Catatan: "escrow" dipertahankan sebagai kata baku lintas layar
 * (konsisten di seluruh app, bukan kata sehari-hari yang diganti).
 */
export const ESCROW_HELD_EXPLANATION =
  "Dana ditahan di escrow untuk pesanan yang belum selesai — cair otomatis saat pesanan selesai atau dibatalkan."
