/**
 * Audit Pesan 2026-10-10 (#10, kosmetik): bahasa produk & i18n di fitur Pesan.
 *
 *   - Tombol beli resmi = "Beli via Kahade" (CLAUDE.md §2).
 *   - Tidak ada istilah terlarang (escrow/rekber/ditahan/penahanan/"Beli
 *     Sekarang") di teks yang TAMPIL — komentar kode boleh menyebutnya.
 *   - Label aksi seleksi, kartu sistem, dan dialog hapus lewat translate().
 */
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const src = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8")

/** Semua literal yang tampil: argumen translate("…") + children JSX teks polos. */
function shownStrings(code: string): string[] {
  const out: string[] = []
  for (const m of code.matchAll(/translate\(\s*(["'`])([\s\S]*?)\1/g)) out.push(m[2])
  for (const m of code.matchAll(/>\s*\n?\s*([A-Z][^<>{}\n]{3,})\s*\n?\s*</g)) out.push(m[1])
  return out
}

const CHAT_FILES = [
  ...readdirSync(resolve(ROOT, "components/ui"))
    .filter((f) => /^(chat-|dm-safety|voice-note)/.test(f) && f.endsWith(".tsx"))
    .map((f) => `components/ui/${f}`),
  ...readdirSync(resolve(ROOT, "components/screens"))
    .filter((f) => f.startsWith("chat-") && f.endsWith(".tsx"))
    .map((f) => `components/screens/${f}`),
  "lib/chat-system.ts",
]

describe("bahasa produk di fitur Pesan", () => {
  it("tombol kartu produk memakai label resmi 'Beli via Kahade'", () => {
    const cards = src("components/ui/chat-cards.tsx")
    expect(cards).toContain('translate("Beli via Kahade")')
    expect(cards).not.toMatch(/translate\("Beli"\)/)
  })

  it("tidak ada istilah terlarang di teks yang tampil", () => {
    const banned = /escrow|rekber|\bditahan\b|penahanan|beli sekarang/i
    for (const rel of CHAT_FILES) {
      for (const s of shownStrings(src(rel))) {
        expect(`${rel}: ${s}`).not.toMatch(banned)
      }
    }
  })
})

describe("i18n fitur Pesan", () => {
  it("label kartu sistem lewat translate()", () => {
    const sys = src("lib/chat-system.ts")
    for (const label of [
      "Pembayaran diterima",
      "Resi diperbarui",
      "Pesanan dikirim",
      "Transaksi selesai",
      "Order dibuat",
      "Info sistem",
    ]) {
      expect(sys).toContain(`translate("${label}")`)
    }
    expect(src("components/ui/chat-system-card.tsx")).toContain(
      'translate("Percakapan ini diarsipkan otomatis.")',
    )
  })

  it("aksi seleksi & dialog hapus di layar ruang tidak lagi literal", () => {
    const room = src("components/screens/chat-room-screen.tsx")
    for (const literal of [
      'label: "Balas"',
      'label: "Salin"',
      'label: "Terjemahkan"',
      'label: "Lihat"',
      'label: "Simpan"',
      'label: "Teruskan"',
      'label: "Ubah"',
      'label: "Hapus"',
      '? "Bintangi" : "Batal bintang"',
      '? "Lepas pin" : "Pin"',
      'confirmLabel="Hapus"',
      '? "Hapus pesan ini?" : "Hapus pesan yang dipilih?"',
    ]) {
      expect(room).not.toContain(literal)
    }
    expect(room).toContain('translate("{x} pesan akan dihapus untuk semua peserta ruang.", { x: deletableCount })')
  })
})
