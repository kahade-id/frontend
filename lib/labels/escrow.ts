/**
 * Kahade — istilah baku tunggal untuk dana pesanan yang belum selesai (FE-004).
 *
 * Satu konsep ini sebelumnya dijelaskan dengan empat istilah berbeda di
 * wallet ("uang jaminan", "dana terkunci", "menahan dana", "jaminan
 * transaksi") — user bisa mengira ini empat hal berbeda. Aturan minimalisme
 * §9.1: satu istilah baku per konsep + satu kalimat penjelasan yang dipakai
 * ulang di semua tempat (hero wallet, sheet rincian saldo, sheet holds).
 */

/** Istilah baku untuk dana pesanan yang belum selesai — satu-satunya yang dipakai di app. */
export const ESCROW_HELD_LABEL = "Dalam transaksi"

/**
 * Satu kalimat penjelasan yang dipakai ulang di semua tempat.
 * Catatan: kata "escrow"/"ditahan" tidak dipakai di teks pengguna (CLAUDE.md §2).
 */
export const ESCROW_HELD_EXPLANATION =
  "Dana dalam transaksi untuk pesanan yang belum selesai — cair otomatis saat pesanan selesai atau dibatalkan."
