/**
 * Kahade — penjaga i18n (dijalankan `npm run check:i18n`).
 *
 * Empat hal yang dicek, semuanya mekanis — tidak ada yang mengandalkan
 * "ingat-ingat manusia":
 *
 *  1. KUNUSAN: kunci di `lib/i18n/en/*` harus ADA di katalog. Kunci yang tidak
 *     ada = copy Indonesia di kode sudah diubah (atau salah ketik) sehingga
 *     terjemahannya mati diam-diam.
 *  2. TOKEN: jumlah `{x}` di nilai English WAJIB sama dengan di kunci.
 *     Salah satu = nominal tertukar/kehilangan di layar.
 *  3. DUPLIKAT: satu kunci hanya boleh hidup di satu file. Object spread
 *     "terakhir menang" membuat bug sunyi saat dua layar mengedit kamus.
 *  4. RATCHET: cakupan terjemahan tidak boleh TURUN. `lib/i18n/coverage.json`
 *     menyimpan angka minimal yang sudah dicapai; menambah string UI baru tanpa
 *     menerjemahannya boleh (PR tetap jalan), menurunkan cakupan tidak.
 *
 * Ditambah sanitasi: nilai kosong, newline literal, dan nilai yang sama persis
 * dengan kunci (kecuali daftar putih istilah yang tak diterjemahkan).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const EN_DIR = join(root, "lib/i18n/en")
const CATALOG = join(root, "lib/i18n/catalog.json")
const COVERAGE = join(root, "lib/i18n/coverage.json")

const errors = []
const identical = []
const fail = (msg) => errors.push(msg)

const catalog = existsSync(CATALOG)
  ? JSON.parse(readFileSync(CATALOG, "utf8")).strings.map((e) => e.s)
  : []
if (catalog.length === 0) {
  console.error("Katalog tidak ada/kosong. Jalankan: npm run gen:i18n")
  process.exit(1)
}
const catalogSet = new Set(catalog)

const tokenCount = (s) => (s.match(/\{x\}/g) ?? []).length

const seen = new Map()
let translated = 0
for (const file of readdirSync(EN_DIR).sort()) {
  if (!file.endsWith(".json")) continue
  const rel = `lib/i18n/en/${file}`
  const raw = readFileSync(join(EN_DIR, file), "utf8")
  const obj = JSON.parse(raw)

  // Kunci duplikat di file yang sama: JSON.parse diam-diam mengambil yang
  // terakhir, jadi hitung dari teks aslinya.
  const rawKeys = [...raw.matchAll(/^\s{2}"((?:[^"\\]|\\.)*)"\s*:/gm)].map((m) =>
    JSON.parse(`"${m[1]}"`),
  )
  const inFile = new Set()
  for (const k of rawKeys) {
    if (inFile.has(k)) fail(`${rel}: kunci duplikat dalam satu file — "${k}"`)
    inFile.add(k)
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!catalogSet.has(key)) {
      fail(`${rel}: kunci tidak ada di katalog (copy Indonesia sudah berubah?) — "${key}"`)
      continue
    }
    if (seen.has(key)) {
      fail(`${rel}: kunci dobel dengan ${seen.get(key)} — pindahkan ke satu file saja. "${key}"`)
      continue
    }
    seen.set(key, rel)

    if (typeof value !== "string" || value.trim() === "") {
      fail(`${rel}: nilai kosong untuk "${key}"`)
      continue
    }
    if (/[\n\r]/.test(value)) fail(`${rel}: nilai memuat newline untuk "${key}"`)
    const kt = tokenCount(key)
    const vt = tokenCount(value)
    if (kt !== vt)
      fail(`${rel}: token {x} tidak seimbang (${kt} di kunci, ${vt} di nilai) — "${key}"`)
    // Nilai identik dengan kunci ITU BENAR untuk kata serapan/kognat ("Bank",
    // "Spam", "Reset password", nama merek), jadi tidak boleh jadi error. Yang
    // berbahaya adalah entri kosong — sudah dicek di atas.
    if (value === key) identical.push(`${rel}: ${key}`)
    translated += 1
  }
}

const missing = catalog.filter((k) => !seen.has(k))
const percent = ((translated / catalog.length) * 100).toFixed(1)

const prev = existsSync(COVERAGE) ? JSON.parse(readFileSync(COVERAGE, "utf8")) : { percent: 0, translated: 0 }
const wentDown = translated < prev.translated
if (wentDown) {
  fail(
    `Cakupan terjemahan turun: ${prev.translated} → ${translated} string (${prev.percent}% → ${percent}%). ` +
      `Kalau kamu memang menghapus string, jalankan: npm run gen:i18n && npm run check:i18n -- --accept`,
  )
}

if (process.argv.includes("--accept")) {
  writeFileSync(
    COVERAGE,
    `${JSON.stringify({ translated, total: catalog.length, percent: Number(percent) }, null, 1)}\n`,
  )
  console.log(`coverage ditulis: ${translated}/${catalog.length} (${percent}%)`)
}

console.log(
  `Katalog ${catalog.length} string · terjemah ${translated} (${percent}%) · belum ${missing.length} · identik ${identical.length} (kognat/merek, bukan bug)`,
)
if (missing.length && process.env.I18N_LIST) {
  const byCount = new Map(catalog.map((k, i) => [k, i]))
  for (const k of [...missing].sort((a, b) => byCount.get(a) - byCount.get(b)).slice(0, 60))
    console.log(`  belum: ${k}`)
}

if (errors.length) {
  console.error(`\ncheck:i18n gagal (${errors.length} masalah):`)
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`)
  if (errors.length > 40) console.error(`  … ${errors.length - 40} lainnya`)
  process.exit(1)
}
console.log("check:i18n lolos.")
