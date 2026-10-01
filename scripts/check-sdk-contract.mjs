#!/usr/bin/env node
/**
 * Gate offline: pastikan setiap paket native yang dipakai aplikasi berada di
 * jalur SDK yang sama dengan versi `expo` yang dipatok.
 *
 * Kenapa ini perlu (audit crash splash 2026-10-01): `npm run check` dan CI
 * hanya menyentuh JS — tidak ada langkah native sama sekali. Akibatnya
 * `expo-document-picker@57.0.2` (jalur SDK 57) bisa hidup di aplikasi SDK 54
 * tanpa ada satu pun gate yang mengeluh. Modul itu dikirim sebagai AAR prebuilt
 * dan ditautkan apa adanya, sehingga build tetap hijau, tetapi saat runtime ia
 * menabrak kelas `expo-modules-core` yang tidak ada di SDK 54 →
 * NoClassDefFoundError di main thread saat registrasi modul (force close saat
 * splash, sebelum JS berjalan).
 *
 * Sumber kebenaran = `node_modules/expo/bundledNativeModules.json` (ikut paket
 * `expo`, jadi jalan tanpa jaringan; `expo install --check` butuh ekspo.dev).
 *
 * Pemakaian: node scripts/check-sdk-contract.mjs [--package=path/package.json]
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

let bundled
try {
  bundled = require("expo/bundledNativeModules.json")
} catch {
  console.error("check:sdk — tidak bisa membaca expo/bundledNativeModules.json (node_modules belum terpasang?)")
  process.exit(2)
}

const pkgArg = process.argv.find((a) => a.startsWith("--package="))
const pkgPath = pkgArg ? pkgArg.slice("--package=".length) : "package.json"
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }

/** ^1.2.3 / ~1.2.3 / 1.2.3 -> [major, minor] */
const majorMinor = (range) => String(range).trim().replace(/^[\^~>=<\s]*/, "").split(".")

const mismatches = []
for (const [name, want] of Object.entries(bundled)) {
  const have = deps[name]
  if (!have || have === "*" || want === "*") continue
  const [hMajor, hMinor] = majorMinor(have)
  const [wMajor, wMinor] = majorMinor(want)
  if (hMajor !== wMajor || hMinor !== wMinor) {
    mismatches.push({ name, have, want })
  }
}

if (mismatches.length === 0) {
  console.log(`check:sdk — OK (${Object.keys(deps).filter((n) => bundled[n]).length} paket native sesuai kontrak SDK)`)
  process.exit(0)
}

console.error("check:sdk — paket native di luar jalur SDK:\n")
for (const m of mismatches) {
  console.error(`  ${m.name}: dipatok ${m.have} — SDK ini memakai ${m.want}`)
}
console.error(
  "\nPerbaiki dengan:  npx expo install --fix\n" +
    "Jangan mencampur jalur SDK: paket versi jalur SDK lain (mis. 55.x+ di SDK 54, atau 14.x di SDK 57)\n" +
    "dikirim sebagai AAR prebuilt dan akan crash saat modul diinisialisasi (lihat docs/audit-crash-splash-2026-10-01.md).",
)
process.exit(1)
