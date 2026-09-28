/**
 * ST-001 (PERF-FIX 2026-09-29): kunci pola "thin shell + React.lazy" untuk
 * rute /scan.
 *
 * `app/scan.tsx` HARUS tetap shell tipis: implementasi layar (±1000 baris +
 * `expo-camera` + `expo-brightness`) dimuat lazy dari
 * `@/components/scan-screen`. Setiap import statis berat yang ditambahkan
 * ke shell akan kembali dievaluasi saat boot native (semua modul rute
 * dievaluasi sinkron — batasan Expo, lihat header app/_layout.tsx) dan
 * membatalkan tujuan pemisahan. Test ini gagal bila pola itu dilanggar.
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = dirname(fileURLToPath(import.meta.url))
const shellSrc = readFileSync(resolve(root, "..", "app", "scan.tsx"), "utf8")

describe("st-001 scan thin shell", () => {
  it("shell memakai React.lazy untuk implementasi layar", () => {
    expect(shellSrc).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(/)
    expect(shellSrc).toContain("@/components/scan-screen")
  })

  it("shell tidak mengimpor modul native berat secara statis", () => {
    for (const heavy of ["expo-camera", "expo-brightness", "expo-av", "expo-video"]) {
      expect(shellSrc).not.toContain(`from "${heavy}"`)
      expect(shellSrc).not.toContain(`from '${heavy}'`)
    }
  })

  it("shell membungkus lazy screen dengan Suspense + fallback", () => {
    expect(shellSrc).toContain("Suspense")
    expect(shellSrc).toContain("fallback")
  })
})
