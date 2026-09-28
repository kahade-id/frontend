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

/**
 * Pabrik URL konstan-https: fungsi yang me-return template literal berawalan
 * `https://<host>/`. Skema + host DIKUNCI oleh kode (template literal) —
 * nilai interpolasi hanya bisa mendarat di path/query/fragment, tidak bisa
 * menyuntik skema (`javascript:`) atau host lain. Contoh:
 * `components/ui/chat-location-card.tsx` membangun URL OpenStreetMap dari
 * koordinat lewat `mapUrl()` — gate lama menandainya false positive.
 *
 * Dikenali: `function name(...) { ... return \`https://...\` }` dan
 * `const name = (...) => \`https://...\``.
 */
function findConstHttpsFactories(src) {
  const names = new Set()
  const fnRe =
    /\bfunction\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[A-Za-z0-9_<>\[\]|,\s]+)?\s*\{[^}]{0,400}?return\s*`https:\/\/[^`]+`/g
  const arrowRe =
    /\b(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>\s*`https:\/\/[^`]+`/g
  let m
  while ((m = fnRe.exec(src))) names.add(m[1])
  while ((m = arrowRe.exec(src))) names.add(m[1])
  return names
}

/**
 * Deteksi statis nilai BERBAHAYA yang tertulis literal di call-site
 * (R-1 audit ronde-2): URL berkredensial (`https://user:pass@host` —
 * menyembunyikan tujuan sebenarnya) dan skema `http:` non-TLS.
 * Validator runtime (`lib/external-url.ts`) sudah menolak keduanya untuk
 * nilai dinamis; pemeriksaan ini menangkap literal yang lolos ke kode.
 */
function findInsecureLiteral(line, constLiterals) {
  const literals = []
  const strRe = /(["'`])((?:\\\1|(?!\1).){0,500})\1/g
  let m
  while ((m = strRe.exec(line))) literals.push(m[2])
  // Argumen berupa identifier yang dideklarasikan sebagai literal string.
  const ident = line.match(/\.openURL\s*\(\s*([A-Za-z0-9_]+)\s*\)/)
  if (ident && constLiterals.has(ident[1])) literals.push(constLiterals.get(ident[1]))
  for (const lit of literals) {
    if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(lit)) return "URL berkredensial (userinfo user:pass@)"
    if (/^http:\/\//i.test(lit)) return "skema http: non-TLS"
  }
  return null
}

function findConstStringLiterals(src) {
  const map = new Map()
  const re = /\bconst\s+([A-Za-z0-9_]+)\s*=\s*(["'])((?:\\\2|(?!\2).){0,500})\2/g
  let m
  while ((m = re.exec(src))) map.set(m[1], m[3])
  return map
}

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
  const constFactories = findConstHttpsFactories(src)
  const constLiterals = findConstStringLiterals(src)
  lines.forEach((line, index) => {
    if (!/\.openURL\s*\(/.test(line)) return
    callSites += 1
    const context = [lines[index - 1] ?? "", line, lines[index + 1] ?? ""].join("\n")
    if (context.includes(ALLOW_MARKER)) {
      notes.push(`${rel}:${index + 1} dikecualikan lewat penanda ${ALLOW_MARKER}`)
      return
    }
    // R-1: tolak literal berbahaya walau "tervalidasi" — kredensial di URL
    // dan http: non-TLS tidak boleh tertulis di call-site.
    const insecure = findInsecureLiteral(line, constLiterals)
    if (insecure) {
      problems.push(`${rel}:${index + 1} — ${insecure} tertulis literal di openURL(). ` +
        `Pakai https: tanpa userinfo, atau bangun URL lewat pabrik konstan.`)
      return
    }
    // Pabrik URL konstan-https: argumen `mapUrl(location)` dkk. — skema &
    // host terkunci template literal (bukan false positive lagi).
    const factoryCall = [...constFactories].some((name) =>
      new RegExp(`\\b${name}\\s*\\(`).test(line),
    )
    if (factoryCall) {
      notes.push(`${rel}:${index + 1} aman — argumen dari pabrik URL konstan-https`)
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
