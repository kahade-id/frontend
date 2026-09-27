/**
 * Regresi audit UI/UX wallet & keuangan 2026-09-27 (TIM WALLET).
 *
 * Mengunci logika tampilan yang diperbaiki:
 *
 *  1. `walletStatusLabel` (UI-W001): baris transaksi wallet dulu meneruskan
 *     enum mentah (`tx.status`) sebagai `statusLabel` — status yang dikenal
 *     normalizer tetapi tak ada di kamus (mis. `PENDING_OTP`, `SUCCESS`,
 *     `WAITING`, `REJECTED`, `EXPIRED`) tampil sebagai teks Inggris mentah
 *     di daftar riwayat. Helper ini menjamin status yang dikenal selalu
 *     berlabel Indonesia.
 *
 *  2. `isQrisExpired` (UI-W008): sheet QRIS Kahade+ dulu menghitung
 *     `expired` dari `Date.now()` sekali per-render tanpa tick — teks
 *     "kedaluwarsa" tak pernah muncul tepat waktu. Aturan kedaluwarsa
 *     diekstrak agar bisa diuji.
 */
import { describe, expect, it } from "vitest"

import { WALLET_TXN_STATUS, WALLET_TXN_STATUS_LABELS } from "../lib/wallet-labels"
import { isQrisExpired, walletStatusLabel } from "../lib/wallet-ui"

describe("walletStatusLabel (UI-W001)", () => {
  it("memberi label Indonesia untuk status yang dikenal normalizer", () => {
    expect(walletStatusLabel("COMPLETED")).toBe("Selesai")
    expect(walletStatusLabel("PENDING")).toBe("Menunggu")
    expect(walletStatusLabel("PROCESSING")).toBe("Diproses")
    expect(walletStatusLabel("FAILED")).toBe("Gagal")
    expect(walletStatusLabel("CANCELLED")).toBe("Dibatalkan")
  })

  it("tidak menampilkan enum mentah untuk status yang dulu bocor", () => {
    // Regresi utama: status-status ini dikenal normalizer tetapi tak ada
    // di kamus lama, sehingga tampil sebagai "PENDING_OTP" dsb.
    expect(walletStatusLabel("SUCCESS")).toBe("Berhasil")
    expect(walletStatusLabel("PENDING_OTP")).toBe("Menunggu OTP")
    expect(walletStatusLabel("WAITING")).toBe("Menunggu")
    expect(walletStatusLabel("REJECTED")).toBe("Ditolak")
    expect(walletStatusLabel("EXPIRED")).toBe("Kedaluwarsa")
  })

  it("setiap kunci WALLET_TXN_STATUS punya label (tidak ada enum bocor)", () => {
    for (const key of Object.keys(WALLET_TXN_STATUS)) {
      const label = walletStatusLabel(key)
      expect(label, `status ${key}`).not.toBe(key)
      expect(label, `status ${key}`).not.toBe("Status belum tersedia")
    }
  })

  it("status kosong → 'Status belum tersedia'", () => {
    expect(walletStatusLabel(null)).toBe("Status belum tersedia")
    expect(walletStatusLabel(undefined)).toBe("Status belum tersedia")
    expect(walletStatusLabel("")).toBe("Status belum tersedia")
  })

  it("status asing tetap jujur (enum asli, bukan tebakan)", () => {
    expect(walletStatusLabel("SOME_FUTURE_STATUS")).toBe("SOME_FUTURE_STATUS")
  })

  it("label tidak pernah sama dengan enum untuk status yang dikenal", () => {
    for (const [key, label] of Object.entries(WALLET_TXN_STATUS_LABELS)) {
      expect(label, `label ${key}`).not.toBe(key)
      expect(label.trim().length, `label ${key}`).toBeGreaterThan(0)
    }
  })
})

describe("isQrisExpired (UI-W008)", () => {
  const NOW = new Date("2026-09-27T10:00:00+07:00").getTime()

  it("true bila tenggat sudah lewat", () => {
    expect(isQrisExpired("2026-09-27T09:59:59+07:00", NOW)).toBe(true)
  })

  it("false bila tenggat masih di depan", () => {
    expect(isQrisExpired("2026-09-27T10:00:01+07:00", NOW)).toBe(false)
  })

  it("false untuk expiredAt kosong/rusak (jangan klaim dari data rusak)", () => {
    expect(isQrisExpired(null, NOW)).toBe(false)
    expect(isQrisExpired(undefined, NOW)).toBe(false)
    expect(isQrisExpired("", NOW)).toBe(false)
    expect(isQrisExpired("bukan-tanggal", NOW)).toBe(false)
  })

  it("batas tepat: now == expiredAt belum kedaluwarsa", () => {
    const at = new Date(NOW).toISOString()
    expect(isQrisExpired(at, NOW)).toBe(false)
  })
})
