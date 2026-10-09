/**
 * Temuan #14 — navbar bawah & konfirmasi keluar aplikasi.
 *
 * Dua hal yang dijaga di sini:
 *
 * 1. Bottom navbar TIDAK punya tombol kembali. Bar adalah pill 4 tab
 *    (Etalase | Transaksi | Pesan | Notifikasi) — tombol kembali di bar
 *    bawah bukan pola standar (Android: gesture/system back; iOS: tidak ada
 *    back global), dan ia akan bersaing dengan back fisik. Dijaga di tingkat
 *    sumber karena tidak ada test render untuk root layout.
 *
 * 2. Back pada HALAMAN TAB UTAMA tanpa riwayat tab tidak lagi langsung
 *    `BackHandler.exitApp()`. Satu ketukan yang tak sengaja dulu menutup
 *    aplikasi tanpa peringatan. Kini: dialog konfirmasi dulu, Back kedua
 *    menutup dialog (bukan keluar).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8")

describe("bottom navbar tanpa tombol kembali", () => {
  const shellTabs = read("lib/shell-tabs.ts")
  const pillBar = read("components/ui/pill-tab-bar.tsx")
  const shellBar = read("components/ui/shell-tab-bar.tsx")

  it("hanya berisi empat tab utama — tanpa slot 'kembali'", () => {
    expect(shellTabs).toMatch(/key:\s*"showcase"/)
    expect(shellTabs).toMatch(/key:\s*"transactions"/)
    expect(shellTabs).toMatch(/key:\s*"chat"/)
    expect(shellTabs).toMatch(/key:\s*"notifications"/)
    expect(shellTabs).not.toMatch(/key:\s*"back"/)
  })

  it("komponen bar tidak mengimpor ikon panah kembali", () => {
    for (const src of [pillBar, shellBar]) {
      expect(src).not.toMatch(/\bArrowLeft\b/)
      expect(src).not.toMatch(/\bCaretLeft\b/)
      expect(src).not.toMatch(/\bArrowUUpLeft\b/)
    }
  })

  it("bar tidak memanggil router.back() / canGoBack()", () => {
    for (const src of [pillBar, shellBar]) {
      expect(src).not.toContain("router.back()")
      expect(src).not.toContain("canGoBack()")
    }
  })
})

describe("konfirmasi keluar aplikasi pada halaman tab utama", () => {
  const layout = read("app/_layout.tsx")

  it("Back tanpa riwayat tab MEMINTA KONFIRMASI, bukan langsung keluar", () => {
    // Urutan yang benar: pop riwayat tab → kalau kosong, buka dialog.
    expect(layout).toMatch(/const previousTab = popPreviousShellTab\(pathname\)/)
    expect(layout).toMatch(/setExitConfirmOpen\(true\)\s*\n\s*return true/)
  })

  it("`exitApp()` hanya boleh dipanggil dari aksi konfirmasi, bukan dari handler Back", () => {
    // Baris komentar dibuang: docblock di atas handler menyebut nama
    // `BackHandler.exitApp()` saat menjelaskan perilaku lama.
    const code = layout
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
      .join("\n")
    const exitAppCalls = code.match(/BackHandler\.exitApp\(\)/g) ?? []
    expect(exitAppCalls).toHaveLength(1)
    // Satu-satunya pemanggilan harus berada di dalam `onConfirm` dialog.
    const confirmBlock = code.slice(code.indexOf("onConfirm={() => {"))
    expect(confirmBlock.slice(0, 400)).toContain("BackHandler.exitApp()")
  })

  it("Back saat dialog terbuka MENUTUP dialog — bukan keluar aplikasi", () => {
    expect(layout).toMatch(
      /if \(exitConfirmOpen\) \{\s*\n\s*setExitConfirmOpen\(false\)\s*\n\s*return true/,
    )
  })

  it("teks konfirmasi lewat i18n (bukan string mentah)", () => {
    expect(layout).toContain('translate("Yakin ingin keluar dari Kahade?")')
  })

  it("handler Back ikut bergantung pada status dialog", () => {
    expect(layout).toMatch(/\}, \[pathname, router, exitConfirmOpen\]\)/)
  })
})
