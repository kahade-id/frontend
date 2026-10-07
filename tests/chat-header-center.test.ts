/**
 * Guard judul header CENTER PRESISI (permintaan produk 2026-10-08).
 *
 * Masalah yang dikunci: judul header tab Transaksi/Pesan/Notifikasi dulu
 * dirender sebagai kolom `flex-1` di antara kolom aksi kiri & kanan — jadi
 * titik tengahnya adalah tengah RUANG SISA, bukan tengah layar. Begitu jumlah
 * atau lebar ikon kiri ≠ kanan, judul bergeser (dan menambal dengan margin
 * manual tidak pernah presisi di semua lebar layar).
 *
 * Kontrak sekarang:
 *   1. Judul digambar ABSOLUT 0 → lebar baris (titik tengahnya = tengah
 *      baris/layar untuk SETIAP lebar layar).
 *   2. Padding kiri == padding kanan == `headerTitleCenterPadding(...)`
 *      (sisi terlebar) — menjamin titik tengah kotak teks tidak bergeser,
 *      berapa pun isi aksi di kedua sisi.
 *   3. Tidak ada lagi `titleAlign="left"` di ketiga tab (termasuk header mode
 *      pilih pada Pesan/Notifikasi) supaya judul tidak menempel ke tepi.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { headerTitleCenterPadding } from "@/lib/header-title"

const ROOT = resolve(__dirname, "..")

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8")
}

describe("headerTitleCenterPadding", () => {
  it("memakai sisi TERLEBAR sebagai padding kedua sisi (simetris)", () => {
    // Dua ikon kiri (96) vs satu ikon kanan (48) → padding 96 di KEDUA sisi.
    expect(headerTitleCenterPadding(96, 48)).toBe(96)
    expect(headerTitleCenterPadding(48, 96)).toBe(96)
    // Simetris → titik tengah kotak teks tetap W/2 untuk semua lebar layar.
    for (const width of [320, 360, 390, 412, 768, 1024]) {
      const pad = headerTitleCenterPadding(96, 48)
      const boxLeft = 0 + pad
      const boxRight = width - pad
      expect((boxLeft + boxRight) / 2).toBe(width / 2)
    }
  })

  it("menyisakan minimal satu slot tombol (48px) agar judul tidak menyentuh tepi", () => {
    expect(headerTitleCenterPadding(0, 0)).toBe(48)
    expect(headerTitleCenterPadding(24, 40)).toBe(48)
  })
})

describe("<Header> center presisi", () => {
  it("judul center digambar absolut selebar baris dengan padding simetris", () => {
    const s = src("components/ui/header.tsx")
    // Baris header harus punya containing block untuk judul absolut.
    expect(s).toContain('className="relative min-h-14 w-full flex-row items-center px-5 py-2"')
    // Kotak judul: 0 → lebar baris, padding kiri == kanan.
    expect(s).toContain('className="absolute inset-y-0 left-0 right-0 items-center justify-center"')
    expect(s).toContain("paddingLeft: titleCenterPadding, paddingRight: titleCenterPadding")
    // Tidak menelan sentuhan tombol di bawahnya.
    expect(s).toContain('pointerEvents="none"')
    // Di tengah vertical baris, bukan digantung dari atas.
    expect(s).toContain("items-center justify-center")
  })

  it("tidak lagi meng-center judul lewat kolom flex-1 antar ikon", () => {
    const s = src("components/ui/header.tsx")
    // Kolom tengah mode center kini hanya spacer; teks pindah ke blok absolut.
    expect(s).toContain('<View className="flex-1" />')
    expect(s).not.toContain('flex-1 items-center justify-center px-2"')
  })

  it("tiga tab (Transaksi, Pesan, Notifikasi) tidak memakai judul rata kiri", () => {
    for (const rel of [
      "components/screens/transactions-tab-screen.tsx",
      "components/screens/chat-tab-screen.tsx",
      "components/screens/notifications-tab-screen.tsx",
    ]) {
      const s = src(rel)
      expect(s, `${rel} tidak boleh memaksa judul rata kiri`).not.toContain('titleAlign="left"')
    }
  })
})
