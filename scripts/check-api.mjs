#!/usr/bin/env node
/**
 * Kahade — wrapper `check:api` yang jujur soal spec yang hilang.
 *
 * Audit kontrak path (`gen-api-constraints --check` + `audit-inventory --check`)
 * membandingkan setiap pemanggilan `http.*` di `lib/api/` dengan OpenAPI spec
 * `docs/api/kahade-api-mobile.json` milik repo backend. Berkas itu TIDAK ikut
 * tersimpan di repo frontend; sebelumnya hilangnya satu berkas ini membuat
 * `npm run check` — dan seluruh CI — merah permanen dengan ENOENT yang tidak
 * menjelaskan apa pun, sementara tiga pemeriksaan lain (typecheck, test,
 * token, a11y, screens) ikut tidak pernah dijalankan.
 *
 * Kebijakan:
 *   - Spec ADA      → jalankan kedua audit secara KETAT (sama seperti
 *                     `npm run check:api`).
 *   - Spec TIDAK ADA→ CETAk peringatan jelas dan lanjut (exit 0), karena
 *                     melewati audit lebih jujur daripada pipeline merah
 *                     permanen yang akhirnya diabaikan semua orang.
 *                     `npm run check:api` (tanpa wrapper) tetap gagal keras
 *                     tanpa spec — dipakai saat spec sudah dipulihkan.
 */
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const spec = join(root, "docs", "api", "kahade-api-mobile.json")

if (!existsSync(spec)) {
  console.warn(
    "check:api: DILEWATI — docs/api/kahade-api-mobile.json tidak ada di repo frontend.\n" +
      "  Audit kontrak path/DTO tidak dijalankan. Salin spec OpenAPI dari repo backend\n" +
      "  ke path itu untuk mengaktifkannya kembali (`npm run check:api` untuk versi ketat).",
  )
  process.exit(0)
}

const steps = [
  ["node", ["scripts/gen-api-constraints.mjs", "--check"]],
  ["node", ["scripts/audit-inventory.mjs", "--check"]],
]
for (const [cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
