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
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { namedTokens } from "../lib/i18n/shape.ts"

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

// Semua token bernama (`{x}`, `{y}`, `{z}`) — F-09: label aksesibilitas
// multi-slot memakai `{y}`/`{z}`, dan hitungan lama yang hanya `{x}` membuat
// terjemahan yang MENJATUHKAN satu slot tetap lolos (mis. "{x} dari {y}" →
// "of {x}").
const tokenCount = (s) => (s.match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) ?? []).length

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

// 5. TEMPLATE-LITERAL DI <Text>/<Heading> (E-03 audit): teks campur nilai
//    runtime ({`Durasi ${x}`}) tidak pernah sampai ke kamus — localizeChildren
//    hanya menerjemahkan string murni, dan penggabungan children di dalam
//    <Text> sengaja dilarang (lib/i18n/translate.ts). Pola yang dipaksa:
//    translate("… {x}", { … }) — literalnya terkatalog gen-i18n dan cocok
//    persis di runtime. Hanya literal di luar ${} yang berisi >=2 huruf
//    berurutan yang dianggap pelanggaran (slot data murni dilewatkan).
{
  const scanDirs = ["app", "components"]
  const walkTsx = function* (dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) yield* walkTsx(full)
      else if (full.endsWith(".tsx")) yield full
    }
  }
  for (const dir of scanDirs) {
    const abs = join(root, dir)
    if (!existsSync(abs)) continue
    for (const file of walkTsx(abs)) {
      const rel = relative(root, file)
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const visit = (node) => {
        if (ts.isJsxElement(node)) {
          const tag = node.openingElement.tagName.getText(sf)
          if (tag === "Text" || tag === "Heading") {
            for (const child of node.children) {
              if (
                ts.isJsxExpression(child) &&
                child.expression &&
                ts.isTemplateExpression(child.expression)
              ) {
                let literal = child.expression.head.text
                for (const span of child.expression.templateSpans) literal += span.literal.text
                if (/[A-Za-z]{2,}/.test(literal)) {
                  const { line } = sf.getLineAndCharacterOfPosition(child.getStart(sf))
                  fail(
                    `${rel}:${line + 1}: template literal di <${tag}> tidak ter-translate (E-03) — pakai translate("… {x}", { …}): ${child
                      .getText(sf)
                      .slice(0, 70)}`,
                  )
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
  }
}

// 6. TOKEN & VAR PADA translate() (F-09): pola `translate("… {x} …", { x })`
//    hanya benar bila (a) nama token unik — `"{x} digit, {y} dari {x} terisi"`
//    menaruh SATU nilai di dua tempat, sehingga "3 dari 6" bisa tercetak
//    "3 dari 3"; (b) nama token mengikuti urutan kanonik x, y, z, w, u, v —
//    supaya kalimat yang sama di dua layar jadi SATU kunci kamus (varian
//    `{a}`/`{b}` membuat kamus terpecah dan cakupan turun tanpa sebab);
//    (c) setiap token punya nilai di objek var dan tidak ada var yang tidak
//    dipakai (typo `{y}` vs `y:` di runtime mencetak "{y}" ke layar/TalkBack).
{
  const CANON = ["x", "y", "z", "w", "u", "v"]
  const scanDirs = ["app", "components", "lib"]
  const walkTs = function* (dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) yield* walkTs(full)
      else if (/\.tsx?$/.test(full)) yield full
    }
  }
  for (const dir of scanDirs) {
    const abs = join(root, dir)
    if (!existsSync(abs)) continue
    for (const file of walkTs(abs)) {
      const rel = relative(root, file)
      if (rel.startsWith("lib/i18n/")) continue
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const visit = (node) => {
        if (ts.isCallExpression(node)) {
          const fn = node.expression.getText(sf)
          if (/(^|\.)(translate|translateProp|t)$/.test(fn)) {
            const [first, second] = node.arguments
            if (first && ts.isStringLiteralLike(first)) {
              const literal = first.text
              const toks = namedTokens(literal)
              if (toks.length > 0) {
                const dup = toks.filter((t, i) => toks.indexOf(t) !== i)
                const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
                if (dup.length > 0)
                  fail(
                    `${rel}:${line}: token translate() terpakai dua kali (${[
                      ...new Set(dup),
                    ].join(", ")}) — satu nilai akan mengisi dua slot. Pakai nama unik x/y/z. "${literal}"`,
                  )
                toks.forEach((t, i) => {
                  if (i < CANON.length && t !== CANON[i])
                    fail(
                      `${rel}:${line}: nama token ke-${i + 1} harus "{${CANON[i]}}" (urutan kanonik x, y, z, w…), bukan "{${t}}" — kunci kamus jadi terpecah antar layar. "${literal}"`,
                    )
                  if (i >= CANON.length)
                    fail(
                      `${rel}:${line}: terlalu banyak slot bernama (maks ${CANON.length}) — pecah kalimatnya. "${literal}"`,
                    )
                })
                if (second && ts.isObjectLiteralExpression(second)) {
                  const vars = new Set(
                    second.properties
                      .filter((p) => ts.isPropertyAssignment(p))
                      .map((p) => p.name.getText(sf).replace(/^["']|["']$/g, "")),
                  )
                  for (const t of new Set(toks))
                    if (!vars.has(t))
                      fail(
                        `${rel}:${line}: token "{${t}}" tidak punya nilai di objek var — runtime mencetak "{${t}}" apa adanya.`,
                      )
                  for (const v of vars)
                    if (!toks.includes(v))
                      fail(`${rel}:${line}: var "${v}" tidak dipakai di literal translate().`)
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
  }
}

if (errors.length) {
  console.error(`\ncheck:i18n gagal (${errors.length} masalah):`)
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`)
  if (errors.length > 40) console.error(`  … ${errors.length - 40} lainnya`)
  process.exit(1)
}
console.log("check:i18n lolos.")
