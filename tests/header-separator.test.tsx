/**
 * Guard <Header> prop `separator` — garis pemisah bawah header.
 *
 * Default true (satu pemisah, satu kali — §6). Tab Transaksi, Pesan, dan
 * Notifikasi mematikan separator atas permintaan produk (2026-09-27).
 *
 * className NativeWind di-hash di jsdom sehingga kehadiran `border-b` tidak
 * bisa diamati dari DOM — guard ini mengunci invarian di level sumber,
 * mengikuti pola tests/bottom-sheet-content.test.tsx.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/header-separator.test.tsx
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "..")

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8")
}

describe("<Header> separator", () => {
  it("prop separator opsional, default true", () => {
    const s = src("components/ui/header.tsx")
    expect(s).toContain("separator?: boolean")
    expect(s).toContain("separator = true")
  })

  it("border-b hanya diterapkan bila separator true (dan bukan transparent)", () => {
    const s = src("components/ui/header.tsx")
    expect(s).toContain('!transparent && separator && "border-b border-border"')
  })

  it("tab Transaksi, Pesan, Notifikasi mematikan separator", () => {
    for (const rel of [
      "app/(tabs)/transactions.tsx",
      "app/(tabs)/chat.tsx",
      "app/(tabs)/notifications.tsx",
    ]) {
      const s = src(rel)
      expect(s, `${rel} harus memakai separator={false}`).toContain("separator={false}")
    }
  })
})
