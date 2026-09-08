/**
 * Kahade — lib/a11y `summarize()` dan lib/hit-slop.
 *
 * Kenapa berkas ini ada: label screen reader kartu/log dulu dirakit manual
 * dengan `[...].filter(Boolean).join(", ")` di belasan komponen. Pola itu
 * lolos review karena terlihat setara dengan `summarize()`, padahal berbeda
 * pada satu hal yang hanya terdengar oleh pengguna screen reader:
 * `filter(Boolean)` meloloskan string yang HANYA berisi spasi, sehingga
 * label terbaca "Login berhasil, , 192.168.1.1" — koma nyasar di tengah
 * kalimat. Uji di bawah mengunci perbedaan itu.
 *
 * Bagian hit-slop mengunci invariant audit #1: slop tidak pernah membuat
 * total ukuran jatuh di bawah `tokens.a11y.minHitTarget`, dan slop horizontal
 * baris teks tetap 0 supaya dua link bertetangga tidak saling menelan tap.
 */
import { describe, expect, it } from "vitest"

import { summarize } from "@/lib/a11y"
import { hitSlopToReach, ICON_SM_HIT_SLOP, ICON_XS_HIT_SLOP, TEXT_ROW_HIT_SLOP } from "@/lib/hit-slop"
import { tokens } from "@/lib/tokens"

describe("summarize()", () => {
  it("membuang fragmen kosong tanpa meninggalkan koma nyasar", () => {
    expect(summarize(["Login berhasil", undefined, "192.168.1.1"])).toBe(
      "Login berhasil, 192.168.1.1",
    )
  })

  /**
   * Inti regresi: nilai dari backend bisa berupa string spasi (bukan "" dan
   * bukan null). `filter(Boolean)` menganggapnya ada.
   */
  it("membuang string yang hanya berisi spasi — kasus yang lolos filter(Boolean)", () => {
    const parts = ["Login berhasil", "   ", "192.168.1.1", "5 Sep 2026"]
    expect(summarize(parts)).toBe("Login berhasil, 192.168.1.1, 5 Sep 2026")
    // Bukti bahwa pola lama memang berbeda — jangan "dirapikan" jadi sama.
    expect(parts.filter(Boolean).join(", ")).toBe("Login berhasil,    , 192.168.1.1, 5 Sep 2026")
  })

  it("men-trim tiap fragmen agar tidak ada spasi ganda saat dibacakan", () => {
    expect(summarize(["  Pesanan #123  ", "  Selesai "])).toBe("Pesanan #123, Selesai")
  })

  it("mengubah angka jadi string, dan membuang false/null/undefined", () => {
    expect(summarize(["Skor", 92, false, null, undefined])).toBe("Skor, 92")
  })

  it("menghasilkan string kosong bila tidak ada fragmen berarti", () => {
    expect(summarize([false, null, undefined, "  "])).toBe("")
  })
})

describe("hitSlop", () => {
  const target = tokens.a11y.minHitTarget

  it("membawa ikon kecil ke target sentuh minimum", () => {
    // Ikon sm 20px -> slop 12 per sisi -> 20 + 24 = 44
    expect(ICON_SM_HIT_SLOP).toEqual({ top: 12, bottom: 12, left: 12, right: 12 })
    expect(tokens.icon.size.sm + ICON_SM_HIT_SLOP.top * 2).toBe(target)
    // Ikon xs 16px -> slop 14 per sisi -> 16 + 28 = 44
    expect(ICON_XS_HIT_SLOP).toEqual({ top: 14, bottom: 14, left: 14, right: 14 })
    expect(tokens.icon.size.xs + ICON_XS_HIT_SLOP.top * 2).toBe(target)
  })

  it("tidak pernah menghasilkan slop negatif untuk elemen yang sudah besar", () => {
    expect(hitSlopToReach(64)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
  })

  it("membulatkan ke atas sehingga ukuran ganjil tetap >= target", () => {
    const slop = hitSlopToReach(21)
    expect(21 + slop.top * 2).toBeGreaterThanOrEqual(target)
  })

  it("TEXT_ROW_HIT_SLOP menambah tinggi saja, bukan lebar", () => {
    const lineHeight = tokens.typography.body.lineHeight
    expect(TEXT_ROW_HIT_SLOP.left).toBe(0)
    expect(TEXT_ROW_HIT_SLOP.right).toBe(0)
    expect(lineHeight + TEXT_ROW_HIT_SLOP.top * 2).toBeGreaterThanOrEqual(target)
  })
})
