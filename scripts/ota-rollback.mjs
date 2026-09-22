/**
 * Kahade — Prosedur Rollback OTA Darurat (J-08).
 *
 * Jalankan: npm run ota:rollback -- [channel]
 * Default channel: production
 *
 * Skrip ini memverifikasi konfigurasi EAS dan memberikan panduan serta
 * perintah rollback darurat untuk memulihkan update OTA bermasalah tanpa
 * memerlukan native rebuild.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo

const projectId = app.extra?.eas?.projectId
const channel = process.argv[2] || "production"

console.log("=== Kahade OTA Rollback Preflight ===")
console.log(`App Name: ${app.name}`)
console.log(`Version:  ${app.version}`)
console.log(`Channel:  ${channel}`)
console.log(`Runtime:  ${JSON.stringify(app.runtimeVersion)}`)

if (!projectId) {
  console.error("GAGAL: app.json belum memiliki extra.eas.projectId.")
  process.exit(1)
}

console.log("\nLangkah Rollback Darurat:")
console.log("1. Cek riwayat update di channel:")
console.log(`   npx eas-cli update:list --channel ${channel}`)
console.log("\n2. Rollback ke grup update sebelumnya:")
console.log(`   npx eas-cli update:rollback --channel ${channel}`)
console.log("\n3. Atau republish group update stabil yang diketahui:")
console.log(`   npx eas-cli update:re-publish --channel ${channel} --group <GROUP_ID>`)
console.log("\nDokumentasi lengkap: docs/OTA-RUNBOOK.md")
