/**
 * SEC-404 (selective): kunci daftar layar ber-guard screen-capture.
 *
 * Kebijakan per 2026-09-27: plugin config app-wide `with-flag-secure`
 * (FLAG_SECURE untuk SELURUH app Android) sudah DIHAPUS — pemblokiran
 * screenshot/screen-recording kini selektif per-layar lewat
 * <ScreenCaptureGuard>, yang di Android men-set FLAG_SECURE per activity
 * (ref-counted per key, aman untuk layar bertumpuk).
 *
 * Test ini memindai source app/*.tsx (bukan render) dan mengunci dua daftar:
 *  1. Layar SENSITIF yang WAJIB ber-guard — bila guard terhapus/terlupa,
 *     test ini merah sebelum rilis.
 *  2. Layar lain TIDAK BOLEH ber-guard — bila seseorang memasang guard di
 *     layar biasa, test ini merah (kebijakan: user tetap boleh screenshot
 *     layar non-sensitif).
 *
 *  PLUS: memastikan plugin app-wide benar-benar hilang (app.json + file),
 *  karena bila plugin kembali, penghapusan selektif ini tidak ada artinya.
 */
import { describe, expect, it } from "vitest"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const appDir = join(repoRoot, "app")

/**
 * Layar sensitif yang WAJIB dilindungi <ScreenCaptureGuard>.
 *
 * Catatan kepemilikan: app/wallet.tsx sedang di-rewrite tim lain — guard di
 * sana berasal dari kode lama dan test ini menguncinya agar tim tersebut
 * tidak menghilangkannya tanpa sadar (verifikasi pasca-rewrite adalah
 * tanggung jawab koordinator tim).
 */
const REQUIRED_GUARDED = [
  "app/wallet.tsx",
  "app/wallet-history.tsx",
  "app/transfer.tsx",
  "app/withdraw.tsx",
  "app/topup.tsx",
  "app/(auth)/verify-otp.tsx",
  "app/change-pin.tsx",
  "app/bank-accounts.tsx",
]

function collectTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectTsx(full))
    else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(full)
  }
  return out
}

function hasGuard(source: string): boolean {
  return (
    source.includes('from "@/components/security/screen-capture-guard"') &&
    source.includes("<ScreenCaptureGuard")
  )
}

describe("selective screenshot blocking (SEC-404)", () => {
  it("plugin app-wide with-flag-secure benar-benar dihapus", () => {
    const appJson = JSON.parse(readFileSync(join(repoRoot, "app.json"), "utf8"))
    const plugins: unknown[] = appJson?.expo?.plugins ?? []
    expect(plugins.some((p) => JSON.stringify(p).includes("with-flag-secure"))).toBe(false)
    expect(existsSync(join(repoRoot, "plugins", "with-flag-secure.js"))).toBe(false)
  })

  it("semua layar sensitif WAJIB ber-guard", () => {
    const missing: string[] = []
    for (const rel of REQUIRED_GUARDED) {
      const full = join(repoRoot, rel)
      expect(existsSync(full), `file layar sensitif hilang: ${rel}`).toBe(true)
      if (!hasGuard(readFileSync(full, "utf8"))) missing.push(rel)
    }
    expect(missing, "layar sensitif tanpa <ScreenCaptureGuard>").toEqual([])
  })

  it("tidak ada layar lain yang ber-guard (kebijakan blokir selektif)", () => {
    const allowed = new Set(REQUIRED_GUARDED)
    const extras: string[] = []
    for (const full of collectTsx(appDir)) {
      if (hasGuard(readFileSync(full, "utf8"))) {
        const rel = relative(repoRoot, full).replace(/\\/g, "/")
        if (!allowed.has(rel)) extras.push(rel)
      }
    }
    expect(extras, "layar NON-sensitif yang ber-guard").toEqual([])
  })
})
