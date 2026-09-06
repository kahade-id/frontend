/**
 * Kahade — turunkan spec OpenAPI khusus mobile dari export backend lengkap.
 *
 *   docs/api/openapi.json            → export penuh backend (313 path,
 *                                      termasuk 93 path admin /v1/admin/*)
 *   docs/api/kahade-api-mobile.json  → subset yang BENAR-BENAR dipanggil
 *                                      aplikasi mobile (path admin dibuang)
 *
 * Kenapa perlu (non-obvious): `gen-api-types.mjs`, `gen-api-constraints.mjs`,
 * dan `audit-inventory.mjs` semuanya membaca `kahade-api-mobile.json`. Kalau
 * yang tersimpan justru export penuh, `gen:api` ikut memancarkan 28 DTO
 * admin-only (BanUserDto, WalletAdjustDto, CreateVoucherDto, …) yang tidak
 * pernah dipakai aplikasi, dan audit kontrak membandingkan permukaan API
 * mobile terhadap ratusan operasi admin yang bukan urusannya. Membuang path
 * `/admin` mengembalikan spec ke lingkup mobile (87 DTO) — persis kontrak yang
 * dipakai `lib/api/*`.
 *
 * Jalankan:  npm run gen:spec           (tulis ulang berkas mobile)
 *            npm run gen:spec -- --check (CI: gagal bila berkas basi)
 *
 * Aturan buang: sebuah path dianggap admin-only bila segmen path memuat
 * `/admin`. Skema di `components` sengaja TIDAK dipangkas — hanya path yang
 * disaring; generator hilir hanya memancarkan skema yang direferensikan path
 * mobile, jadi skema admin yang menganggur tidak ikut keluar.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourcePath = resolve(root, "docs/api/openapi.json")
const outPath = resolve(root, "docs/api/kahade-api-mobile.json")

if (!existsSync(sourcePath)) {
  console.error(
    "gen-mobile-spec: docs/api/openapi.json tidak ada. Salin export OpenAPI penuh " +
      "dari repo backend ke path itu, lalu jalankan ulang `npm run gen:spec`.",
  )
  process.exit(1)
}

const isAdminPath = (url) => url.includes("/admin")

const full = JSON.parse(readFileSync(sourcePath, "utf8"))
const paths = {}
let dropped = 0
for (const [url, verbs] of Object.entries(full.paths)) {
  if (isAdminPath(url)) {
    dropped += 1
    continue
  }
  paths[url] = verbs
}
const mobile = { ...full, paths }
const content = JSON.stringify(mobile, null, 2) + "\n"

if (process.argv.includes("--check")) {
  const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : ""
  if (current !== content) {
    console.error(
      "gen-mobile-spec: docs/api/kahade-api-mobile.json basi terhadap docs/api/openapi.json. " +
        "Jalankan `npm run gen:api` untuk meregenerasi spec mobile, tipe, dan constraint.",
    )
    process.exit(1)
  }
  console.log(
    `Mobile spec sinkron: ${Object.keys(paths).length} path (buang ${dropped} path admin).`,
  )
} else {
  writeFileSync(outPath, content)
  console.log(
    `Wrote ${outPath.replace(root + "/", "")}: ${Object.keys(paths).length} path ` +
      `(buang ${dropped} path admin dari ${Object.keys(full.paths).length}).`,
  )
}
