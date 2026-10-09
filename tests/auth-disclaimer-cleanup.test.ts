/**
 * Guard regresi pembersihan disclaimer auth (overhaul auth 2026-10-10, bagian 4).
 *
 * Sebelum perubahan ini, delapan layar alur masuk/daftar mencetak paragraf
 * panjang di kaki layar: "Demi keamanan, lokasi perangkat dapat dicatat jika
 * Anda mengizinkan akses." (8×), "Kami akan meminta Anda mengirim pesan ke
 * WhatsApp resmi Kahade, lalu membalas kode verifikasi 6 digit.", "Anda akan
 * diminta mengirim pesan ke WhatsApp kami terlebih dahulu.", dan kalimat
 * S&K versi lama di langkah terakhir pendaftaran. Semuanya mendorong tombol
 * aksi makin jauh dan mengulang penjelasan yang sama di tiap layar.
 *
 * Kebijakan baru: SATU baris persetujuan (<LegalConsent>) di layar yang memang
 * momen persetujuan, dan detail teknis di balik ikon ⓘ (<AuthSecurityInfo>)
 * yang membuka Dialog + artikel Pusat Bantuan.
 *
 * Guard ini membaca SUMBER (bukan merender) karena yang dikunci adalah
 * absennya sebuah paragraf di 8 berkas berbeda dan hadirnya ⓘ di headernya —
 * merender kedelapan layar butuh mock API/sesi per layar, dan satu layar yang
 * gagal mount akan menyembunyikan regresi di tujuh layar lainnya.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

/** Paragraf yang DIHAPUS — tidak boleh muncul lagi di UI mana pun. */
const REMOVED_PARAGRAPHS = [
  "Demi keamanan, lokasi perangkat dapat dicatat jika Anda mengizinkan akses.",
  "Kami akan meminta Anda mengirim pesan ke WhatsApp resmi Kahade, lalu membalas kode verifikasi 6 digit.",
  "Anda akan diminta mengirim pesan ke WhatsApp kami terlebih dahulu.",
  "Dengan membuat akun, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi Kahade.",
] as const

/** Istilah terlarang kebijakan copy 2026-10-10. */
const BANNED_WORDS = ["escrow", "rekber", "ditahan"] as const

/**
 * Layar auth yang dulu mencetak disclaimer dan sekarang WAJIB punya ⓘ di
 * header. Dua entri terakhir bukan layar melainkan form yang dirender di dalam
 * <LoginMethodScreen> — headernya (beserta ⓘ) milik layar metode, jadi formnya
 * cukup bersih dari paragraf.
 */
const INFO_SCREENS = [
  ["app/(auth)/register.tsx", "signUp"],
  ["app/(auth)/register-security.tsx", "signUp"],
  ["app/(auth)/forgot-password.tsx", "whatsappOtp"],
  ["app/(auth)/reset-password.tsx", "password"],
  ["app/(auth)/verify-otp.tsx", "whatsappOtp"],
  ["app/(auth)/phone-migration.tsx", "signIn"],
] as const

const CLEANED_FORMS = [
  "components/auth/login-password-form.tsx",
  "components/auth/login-whatsapp-form.tsx",
] as const

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(entry)) yield full
  }
}

/** Buang komentar supaya docblock yang MENGUTIP paragraf lama tidak kena. */
function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function read(rel: string) {
  return stripComments(readFileSync(join(ROOT, rel), "utf8"))
}

describe("disclaimer auth dibersihkan (P4)", () => {
  it("paragraf lama tidak muncul lagi di app/ maupun components/", () => {
    const offenders: string[] = []
    for (const dir of ["app", "components"]) {
      for (const file of walk(join(ROOT, dir))) {
        const source = stripComments(readFileSync(file, "utf8"))
        for (const paragraph of REMOVED_PARAGRAPHS) {
          if (source.includes(paragraph)) {
            offenders.push(`${file.replace(`${ROOT}/`, "")} → "${paragraph.slice(0, 48)}…"`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it.each(INFO_SCREENS)("%s memasang ⓘ variant=\"%s\" di header", (file, variant) => {
    const source = read(file)

    expect(source).toContain("<AuthSecurityInfo")
    expect(source).toContain(`variant="${variant}"`)
    // ⓘ harus di slot `right` <Header>: di badan layar ia berubah jadi
    // paragraf lain yang harus dibaca sebelum bertindak.
    expect(source).toMatch(/right=\{\s*<AuthSecurityInfo/)
  })

  it.each(CLEANED_FORMS)("%s tidak lagi mencetak paragraf caption di kaki form", (file) => {
    const source = read(file)

    for (const paragraph of REMOVED_PARAGRAPHS) expect(source).not.toContain(paragraph)
    expect(source).not.toContain("lokasi perangkat")
  })

  it("langkah terakhir pendaftaran memakai SATU baris persetujuan", () => {
    const source = read("app/(auth)/register-security.tsx")

    expect(source).toContain('<LegalConsent action="signUp" />')
    // Baris itu pengganti dua blok caption lama, bukan tambahan.
    expect(source.match(/<LegalConsent/g)).toHaveLength(1)
  })

  it("tidak ada istilah terlarang di copy layar auth", () => {
    // `read()` membuang komentar: docblock yang MENYEBUT kebijakan copy
    // ("tanpa teks escrow/rekber/ditahan") justru penanda kepatuhan, bukan
    // pelanggaran. Yang diuji adalah teks yang bisa sampai ke layar.
    const offenders: string[] = []
    for (const file of [...walk(join(ROOT, "app/(auth)")), ...CLEANED_FORMS.map((f) => join(ROOT, f))]) {
      const source = read(file.replace(`${ROOT}/`, "")).toLowerCase()
      for (const word of BANNED_WORDS) {
        if (source.includes(word)) offenders.push(`${file.replace(`${ROOT}/`, "")} → "${word}"`)
      }
    }
    expect(offenders.length, offenders.join("\n")).toBe(0)
  })
})
