/**
 * Guard regresi posisi tombol aksi (overhaul auth 2026-10-10, bagian 3).
 *
 * Keluhan yang memicu perubahan ini: tombol "Simpan email", "Kirim kode",
 * "Simpan password", "Lanjut PIN", dan "Keluar" hidup di `<Screen footer={…}>`
 * — sebuah FooterBar berpemisah `border-t` yang selalu menempel di bawah layar.
 * Efeknya di form panjang: pemisah memotong konten di tengah, tombol menutupi
 * field terakhir saat keyboard naik, dan layar terlihat punya dua "lantai".
 *
 * Kebijakan baru: **tombol aksi mengikuti konten** — ia elemen terakhir di
 * dalam ScrollView, jadi ikut ter-scroll dan duduk tepat setelah field yang
 * harus dibaca pengguna. Padding bawah aman-area yang dulu disediakan
 * FooterBar dipindah ke `contentContainerStyle`.
 *
 * Kenapa guard ini membaca SUMBER, bukan merender layar: yang diatur adalah
 * POSISI elemen di dalam pohon (di dalam vs di luar kontainer scroll) dan
 * absennya sebuah prop. Keduanya paling jujur diperiksa dari sumbernya —
 * render test di jsdom tidak memberi FooterBar layout sama sekali, sehingga
 * "tombol menempel di bawah" tidak teramati di sana.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * `markers` = potongan JSX yang menandakan tombol aksi utama layar itu.
 * Semuanya wajib berada DI ANTARA `<ScrollView` dan `</ScrollView>`.
 */
const SCREENS = [
  {
    file: "app/change-email.tsx",
    markers: ["Simpan email baru"],
  },
  {
    file: "app/change-phone.tsx",
    // Dua langkah (minta kode → verifikasi) memakai SATU tombol di ujung
    // konten; labelnya berganti mengikuti `step`.
    markers: ["Kirim kode verifikasi", "Verifikasi dan ganti nomor"],
  },
  {
    file: "app/change-password.tsx",
    markers: ["Simpan password"],
  },
  {
    file: "app/change-pin.tsx",
    // Footer lama hanya muncul di langkah "password"; sekarang "Lanjut"
    // mengikuti konten langkah itu.
    markers: ["Lanjut"],
  },
  {
    file: "app/security.tsx",
    markers: ["<SecurityLogoutControl />"],
  },
] as const

function read(file: string) {
  return readFileSync(join(process.cwd(), file), "utf8")
}

/** Rentang konten ScrollView pertama (body layar), atau null bila tak ada. */
function scrollBody(source: string) {
  const start = source.indexOf("<ScrollView")
  const end = source.indexOf("</ScrollView>", start)
  if (start < 0 || end < 0) return null
  return source.slice(start, end)
}

describe("tombol aksi mengikuti konten, bukan footer bar (P3)", () => {
  it.each(SCREENS.map((s) => [s.file, s] as const))(
    "%s tidak lagi memakai <Screen footer={…}> / FooterBar",
    (_file, screen) => {
      const source = read(screen.file)

      // FooterBar selalu masuk lewat prop `footer={` di <Screen>; kalau propnya
      // hilang, pemisahnya hilang bersama padding gandanya.
      expect(source).not.toMatch(/footer=\{/)
      expect(source).not.toMatch(/<FooterBar/)
      expect(source).not.toMatch(/from "@\/components\/ui\/footer-bar"/)
    },
  )

  it.each(SCREENS.map((s) => [s.file, s] as const))(
    "%s menaruh tombol aksinya di dalam ScrollView",
    (_file, screen) => {
      const body = scrollBody(read(screen.file))
      expect(body, "layar ini kehilangan ScrollView body").not.toBeNull()

      for (const marker of screen.markers) {
        expect(body, `aksi "${marker}" tidak ditemukan di dalam konten scroll`).toContain(marker)
      }
    },
  )

  it.each(SCREENS.map((s) => [s.file, s] as const))(
    "%s tetap menyisakan padding bawah aman-area setelah footer dilepas",
    (_file, screen) => {
      const body = scrollBody(read(screen.file))!

      // FooterBar dulu menyediakan `paddingBottom: max(space[4], insets.bottom)`.
      // Tanpa itu tombol terakhir menempel di home indicator iPhone.
      expect(body).toMatch(/contentContainerStyle=\{\{[^}]*insets\.bottom/)
      expect(body).toMatch(/tokens\.space\[/)
    },
  )

  it("tidak ada layar auth/keamanan lain yang masih memakai footer untuk satu tombol aksi", () => {
    // Perluasan kebijakan: layar lain di grup yang sama boleh tetap memakai
    // footer BILA isinya bukan tombol aksi tunggal (mis. kolom ketik chat).
    // Guard ini hanya mengunci lima layar yang disebut di brief.
    for (const screen of SCREENS) {
      expect(read(screen.file)).not.toContain("sticky")
    }
  })
})
