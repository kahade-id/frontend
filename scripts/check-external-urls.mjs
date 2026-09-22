/**
 * Kahade — gate validasi URL eksternal (D-01 audit).
 *
 * Jalankan: node scripts/check-external-urls.mjs
 *
 * ── Kenapa skrip ini harus ada ──
 *
 * Temuan D-01: tiga tempat memanggil `Linking.openURL()` dengan nilai yang
 * berasal dari respons server atau parameter rute, dan hanya sebagian yang
 * memvalidasi skema. Di web `openURL("javascript:…")` mengeksekusi skrip; di
 * native `intent://` meluncurkan komponen lain. Validatornya kini ada di
 * `lib/external-url.ts` (`safeExternalUrl` / `safeHttpsLink` /
 * `safeWhatsAppLink`), tetapi validator yang tidak dipanggil tidak melindungi
 * apa pun: call-site BARU tetap bisa menembak `openURL` dengan data mentah.
 *
 * Karena itu gate ini memeriksa setiap berkas yang memanggil `.openURL(`:
 * berkas itu wajib melewati salah satu validator di atas (atau helper lokal
 * berawalan `safe`), kecuali diberi penanda `openurl-allow` dengan alasan
 * eksplisit. Aturan ini murah, deterministik, dan menangkap regresi kelas ini
 * pada commit pertama — bukan setelah dipakai penyerang.
 *
 * Hanya memakai modul bawaan Node; sengaja tidak butuh build.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const problems = []
const notes = []

const VALIDATORS = [
  "safeExternalUrl(",
  "safeHttpsLink(",
  "safeWhatsAppLink(",
  "safeHttpsUrl(",
]
/** Helper lokal yang dianggap memvalidasi: namanya harus jelas berawalan safe. */
const LOCAL_VALIDATOR = /\bfunction\s+(safe[A-Za-z0-9_]*|assert[A-Za-z0-9_]*Url)\s*\(/
const ALLOW_MARKER = "openurl-allow"

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p)
  }
  return out
}

const files = [
  ...walk(join(root, "app")),
  ...walk(join(root, "components")),
  ...walk(join(root, "lib")),
]

let callSites = 0
for (const abs of files) {
  const src = readFileSync(abs, "utf8")
  const rel = relative(root, abs).split("\\").join("/")
  const lines = src.split("\n")
  lines.forEach((line, index) => {
    if (!/\.openURL\s*\(/.test(line)) return
    callSites += 1
    const context = [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join("\n")
    if (context.includes(ALLOW_MARKER)) {
      notes.push(`${rel}:${index + 1} dikecualikan lewat penanda ${ALLOW_MARKER}`)
      return
    }
    const validated =
      VALIDATORS.some((validator) => src.includes(validator)) || LOCAL_VALIDATOR.test(src)
    if (!validated) {
      problems.push(
        `${rel}:${index + 1} — openURL() tanpa validator. Bungkus nilai dengan ` +
          `safeHttpsLink()/safeExternalUrl() dari lib/external-url.ts, atau beri ` +
          `penanda "${ALLOW_MARKER}: <alasan>" bila nilainya benar-benar konstanta lokal.`,
      )
    }
  })
}

if (!callSites) {
  // Bukan kegagalan, tetapi tidak ada yang diperiksa berarti gate ini tidak
  // berguna — dan keheningan seperti itu biasanya berarti pola panggilannya
  // berubah nama tanpa gate ini ikut diperbarui.
  notes.push("tidak ada pemanggilan .openURL() ditemukan — periksa apakah polanya berubah")
}

for (const note of notes) console.log(`  catatan  ${note}`)
for (const problem of problems) console.error(`  FAIL  ${problem}`)
if (problems.length) {
  console.error(`\ncheck-external-urls: ${problems.length} pelanggaran.`)
  process.exit(1)
}
console.log(`check-external-urls: OK — ${callSites} pemanggilan openURL(), semuanya tervalidasi.`)
