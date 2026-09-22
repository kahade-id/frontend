/**
 * Penjaga `cn()` (lib/cn.ts) — bug layout sistemik QA 2026-09.
 *
 * Sebelum perbaikan, cn() hanya menggabung string sehingga utility yang
 * bertentangan dua-duanya ikut terkirim dan pemenangnya ditentukan urutan CSS
 * Tailwind (nilai besar menang). Test ini mengunci dua hal:
 *   1. yang ditulis TERAKHIR menang (niat `cn(default, override)`), dan
 *   2. type scale Kahade (`text-h1`) TIDAK dianggap warna, sehingga
 *      `text-h1 text-primary` dua-duanya bertahan — kekhawatiran yang dulu
 *      membuat repo menolak tailwind-merge.
 */
import { describe, expect, it } from "vitest"

import { cn, CN_BORDER_WIDTH_SCALE, CN_TYPE_SCALE } from "@/lib/cn"
import { typography } from "@/lib/tokens"

describe("cn() menyelesaikan konflik utility", () => {
  it("padding: override pemanggil mengalahkan default komponen", () => {
    // Persis kasus BottomSheet: cn("shrink px-5 pt-2 pb-4", "px-0 pb-0").
    expect(cn("shrink px-5 pt-2 pb-4", "px-0 pb-0")).toBe("shrink pt-2 px-0 pb-0")
  })

  it("padding sebagian sisi: pl-0 mengalahkan px-5", () => {
    expect(cn("px-5", "pl-0")).toBe("px-5 pl-0")
    expect(cn("px-5 py-2", "px-4")).toBe("py-2 px-4")
  })

  it("gap, lebar, arah flex, radius: yang terakhir menang", () => {
    expect(cn("gap-4", "gap-1")).toBe("gap-1")
    expect(cn("w-full", "w-10")).toBe("w-10")
    expect(cn("flex-col items-center gap-3", "flex-row items-end gap-1")).toBe(
      "flex-row items-end gap-1",
    )
    expect(cn("rounded-sm", "rounded-full")).toBe("rounded-full")
  })

  it("type scale dan warna teks tidak saling membuang", () => {
    expect(cn("text-h1", "text-primary")).toBe("text-h1 text-primary")
    // `text-caption` dibuang (kalah oleh text-body); kelas warna tak tersentuh
    // dan urutan asli kelas yang bertahan dipertahankan.
    expect(cn("text-caption text-text-secondary", "text-body")).toBe("text-text-secondary text-body")
    // Ukuran teks tetap bisa di-override oleh ukuran lain.
    expect(cn("text-body", "text-caption")).toBe("text-caption")
  })

  it("variant tidak dianggap konflik dengan kelas tanpa variant", () => {
    expect(cn("px-5", "md:px-0")).toBe("px-5 md:px-0")
    expect(cn("px-5", "web:px-0")).toBe("px-5 web:px-0")
    // Sesama variant yang sama tetap berkonflik.
    expect(cn("md:px-5", "md:px-0")).toBe("md:px-0")
  })

  it("kelas non-standard repo tidak dibuang", () => {
    expect(cn("opacity-disabled z-bottomSheet", "px-5")).toBe("opacity-disabled z-bottomSheet px-5")
  })

  it("bentuk kondisional (array / object / angka / falsy) tetap didukung", () => {
    expect(cn("px-5", false, null, undefined, ["py-2", { "pb-0": true, "pb-4": false }])).toBe(
      "px-5 py-2 pb-0",
    )
    expect(cn()).toBe("")
  })

  it("type scale terdaftar lengkap sesuai tokens.typography", () => {
    expect([...CN_TYPE_SCALE].sort()).toEqual(Object.keys(typography).sort())
  })
})

/**
 * Bug QA 2026-09-21: "input jadi transparan saat fokus".
 *
 * Akar masalahnya bukan CSS variable: tailwind-merge mengenali `border-focus`
 * sebagai kelas WARNA border (sufiks tak dikenal → grup border-color), lalu
 * membuangnya karena kalah oleh `border-border-focus`. Yang tersisa hanya
 * kelas warna tanpa lebar — border 0px, jadi garisnya hilang.
 *
 * Perbaikannya: lebar border bernama (`border-focus` / `border-error` /
 * `border-badge`) didaftarkan sebagai classGroup sendiri (`border-w`) sehingga
 * hanya saling mengalahkan sesama lebar, tidak dengan warna.
 */
describe("cn() membedakan lebar border bernama dari warna border", () => {
  it("border-focus (lebar) bertahan bersama border-border-focus (warna)", () => {
    // Persis kasus Input saat fokus: cn("border border-border-control",
    //   "border-focus border-border-focus").
    expect(cn("border border-border-control", "border-focus border-border-focus")).toBe(
      "border-focus border-border-focus",
    )
  })

  it("border-error dan border-badge juga tidak dibuang warna", () => {
    expect(cn("border border-border-control", "border-error border-border-error")).toBe(
      "border-error border-border-error",
    )
    expect(cn("border-2 border-border", "border-badge border-background")).toBe(
      "border-badge border-background",
    )
  })

  it("sesama lebar bernama tetap saling mengalahkan (yang terakhir menang)", () => {
    expect(cn("border-focus", "border-error")).toBe("border-error")
    // Lebar bernama mengalahkan lebar numerik biasa, dan sebaliknya.
    expect(cn("border", "border-focus")).toBe("border-focus")
    expect(cn("border-focus", "border-0")).toBe("border-0")
  })

  it("lebar bernama terdaftar lengkap sesuai CN_BORDER_WIDTH_SCALE", () => {
    expect([...CN_BORDER_WIDTH_SCALE].sort()).toEqual(["badge", "error", "focus"])
  })
})
