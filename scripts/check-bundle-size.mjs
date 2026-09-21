/**
 * H-07 (audit 2026-09-20): anggaran ukuran export web.
 *
 * Tidak ada pengukuran performa apa pun sebelumnya — angka 4,32 MB hanya
 * hidup di dokumen audit. Skrip ini menjadikan ukuran `dist/` terukur di
 * setiap build CI dan MENOLAK kenaikan > 10% dari baseline tersimpan.
 *
 * Pemakaian:
 *   npm run build:web            # hasilkan dist/
 *   node scripts/check-bundle-size.mjs            # bandingkan dengan baseline
 *   node scripts/check-bundle-size.mjs --update   # simpan ulang baseline
 *
 * Baseline: scripts/bundle-size-budget.json (masuk git). Perbarui baseline
 * HANYA lewat PR yang sengaja menambah aset/kode, dengan alasan di deskripsi
 * PR — jangan --update untuk meloloskan regresi diam-diam.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = process.env.WEB_ROOT || join(root, "dist")
const budgetFile = join(root, "scripts", "bundle-size-budget.json")
const THRESHOLD = 1.1 // alarm bila total > baseline * 1.10 (saran audit H-07)
const update = process.argv.includes("--update")

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

if (!existsSync(outDir)) {
  console.error(`check-bundle-size: ${outDir} tidak ada — jalankan \`npm run build:web\` dulu.`)
  process.exit(1)
}

const files = walk(outDir)
const sizes = files.map((file) => ({
  path: relative(outDir, file).replaceAll("\\", "/"),
  bytes: statSync(file).size,
}))

// Penjaga integritas: dist/ tanpa bundle JS berarti export gagal/setengah
// jalan (mis. build dibatalkan) — membandingkannya dengan baseline akan
// terlihat seperti "turun drastis" yang sehat padahal artefak rusak.
if (!sizes.some((f) => f.path.includes("_expo/static/js/") && f.path.endsWith(".js"))) {
  console.error(
    "check-bundle-size: GAGAL — tidak ada bundle JS di dist/; export web tidak lengkap. " +
      "Jalankan ulang `npm run build:web` dan perbaiki kegagalan build-nya.",
  )
  process.exit(1)
}
const total = sizes.reduce((sum, f) => sum + f.bytes, 0)
const jsTotal = sizes.filter((f) => f.path.endsWith(".js")).reduce((sum, f) => sum + f.bytes, 0)
const top = [...sizes].sort((a, b) => b.bytes - a.bytes).slice(0, 10)

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`
console.log(`Total export : ${mb(total)} (${sizes.length} file)`)
console.log(`Subset JS    : ${mb(jsTotal)}`)
console.log("10 file terbesar:")
for (const f of top) console.log(`  ${mb(f.bytes).padStart(9)}  ${f.path}`)

const snapshot = {
  totalBytes: total,
  jsBytes: jsTotal,
  fileCount: sizes.length,
  measuredAt: new Date().toISOString().slice(0, 10),
}

if (update || !existsSync(budgetFile)) {
  writeFileSync(budgetFile, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    update
      ? `Baseline diperbarui: ${budgetFile}`
      : `Baseline belum ada — dibuat: ${budgetFile}`,
  )
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(budgetFile, "utf8"))
const ratio = total / baseline.totalBytes
console.log(`Baseline     : ${mb(baseline.totalBytes)} (${baseline.measuredAt})`)
console.log(`Rasio        : ${(ratio * 100).toFixed(1)}% dari baseline (batas ${(THRESHOLD * 100).toFixed(0)}%)`)

if (ratio > THRESHOLD) {
  console.error(
    `check-bundle-size: GAGAL — export naik ${((ratio - 1) * 100).toFixed(1)}% ` +
      `(> ${((THRESHOLD - 1) * 100).toFixed(0)}%). Periksa file terbesar di atas; ` +
      "bila kenaikan memang disengaja, jalankan --update lewat PR dengan alasan.",
  )
  process.exit(1)
}
if (ratio < 0.9) {
  console.log(
    "Catatan: export turun > 10% dari baseline — pertimbangkan --update agar " +
      "alarm regresi tetap sensitif.",
  )
}
console.log("check-bundle-size: OK dalam anggaran.")
