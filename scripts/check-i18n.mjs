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

/**
 * G-04 (audit 2026-09-22): daftar putih KOGNAT/MEREK.
 *
 * Gate lama menyebut setiap entri identik "kognat/merek, bukan bug" tanpa
 * memeriksa satu pun — entri yang lupa diterjemahkan (mis. "Pin" untuk PIN
 * perangkat, atau istilah yang kebetulan sama) ikut tersembunyi di angka itu.
 * Dengan allowlist eksplisit, entri identik BARU langsung gagal dan harus
 * diputuskan: diterjemahkan, atau didaftarkan di sini dengan alasannya.
 */
const COGNATE_ALLOWLIST = new Map([
  // Nama merek/produk — tidak pernah diterjemahkan.
  ["Kahade", "nama produk"],
  ["WhatsApp", "nama layanan"],
  ["JNE, SiCepat, …", "nama kurir"],
  // Kata serapan yang memang dipakai di UI English.
  ["Email", "serapan baku"],
  ["Reset password", "istilah baku keamanan"],
  ["Cashback", "istilah baku e-commerce"],
  ["Showcase", "istilah produk Kahade"],
  ["Invoice", "istilah dokumen"],
  ["Order", "istilah transaksi"],
  ["Bank", "serapan baku"],
  ["Bank / e-wallet", "serapan baku + istilah produk"],
  ["Bio", "label singkat profil"],
  ["Personal", "nama jenis akun"],
  ["Rating", "serapan baku"],
  ["Reward", "serapan baku"],
  ["Status", "serapan baku"],
  ["Username", "istilah baku akun"],
  ["Referral", "serapan baku"],
  ["Legal", "nama seksi"],
  ["Menu", "serapan baku"],
  ["Transfer", "serapan baku"],
  ["Spam", "serapan baku"],
  ["Edit", "serapan baku"],
  ["Chat", "serapan baku"],
  ["Minimum:", "label dengan titik dua, sama di kedua bahasa"],
  ["Runtime:", "label dengan titik dua, sama di kedua bahasa"],
  // Operasi ikon: "pin" (kerja) sama di EN; yang beda adalah "Lepas pin".
  ["Pin", "kata kerja 'pin' sama di EN"],
  // Bentuk yang HANYA terdiri dari token + tanda baca: tidak ada teks untuk
  // diterjemahkan — pengisian token mengikuti bahasa pemanggil.
  ["{x} {y}", "hanya token"],
  ["{x} {y}%", "hanya token + %"],
  ["{x} {y} rupiah", "hanya token + satuan mata uang"],
  ["{x} {y}%, {z} rupiah", "hanya token + satuan mata uang"],
  ["{x} — {y}", "hanya token + pemisah"],
  ["{x}, {y}", "hanya token + pemisah"],
  ["{x}. {y}", "hanya token + pemisah"],
  ["{x}: {y}", "hanya token + pemisah"],
  ["Item {x}", "hanya token + kata benda yang sama di EN"],
])

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
    // G-04: identik hanya boleh untuk kognat/merek yang terdaftar.
    if (value === key) {
      if (!COGNATE_ALLOWLIST.has(key))
        fail(
          `${rel}: terjemahan identik dengan sumber — "${key}". Kalau ini memang ` +
            `kognat/merek, daftarkan di COGNATE_ALLOWLIST beserta alasannya; kalau bukan, terjemahkan.`,
        )
      identical.push(`${rel}: ${key}`)
    }
    translated += 1
  }
}

const missing = catalog.filter((k) => !seen.has(k))
const percent = ((translated / catalog.length) * 100).toFixed(1)

/*
 * G-03 (audit 2026-09-22): "100%" hanya bermakna bila setiap kunci katalog
 * BENAR-BENAR punya terjemahan. Sebelumnya gate hanya memasang ratchet
 * (cakupan tidak boleh turun), jadi katalog yang di-generate ulang selalu
 * tampak 100% walau kunci barunya jatuh ke teks sumber. Sejak sekarang kunci
 * tanpa terjemahan = GAGAL: string UI baru harus diberi terjemahan di batch
 * yang sama (fallback runtime ke Indonesia tetap ada sebagai jaring pengaman,
 * bukan sebagai kebijakan).
 */
if (missing.length > 0) {
  const detail = process.env.I18N_LIST ? `\n${missing.slice(0, 40).map((k) => `    - ${k}`).join("\n")}` : ""
  fail(
    `${missing.length} kunci katalog belum punya terjemahan (lihat I18N_LIST=1 untuk daftarnya) — ` +
      `tambahkan ke lib/i18n/en/*.json dalam batch yang sama.${detail}`,
  )
}

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
                // Angka di dalam literal DIMASKING menjadi `{x}` oleh
                // `maskNumbers` (bentuk kunci = teks dengan angka → {x}), jadi
                // `"{x} memberi {y} dari 5 bintang"` menghasilkan kunci ber-token
                // `{x}` dua kali: nilai runtime "5" mengisi slot PERTAMA dan nama
                // pemberi ulasan tercetak sebagai "5 memberi 4 dari Budi bintang".
                // Angka yang memang bagian dari kalimat harus masuk lewat token
                // bernama (`{z: 5}`) atau ditulis sebagai kata ("lima").
                if (/\d/.test(literal))
                  fail(
                    `${rel}:${line}: literal translate() memuat token bernama SEKALIGUS angka — angka akan jadi token {x} dan bertabrakan dengan var. Pindahkan angka ke token bernama (mis. {z: 5}). "${literal}"`,
                  )
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

// 7. TEMPLATE LITERAL BER-PROSА DI PROP TEKS (G-01 audit): `localizeChildren`
//    hanya menerjemahkan children <Text> berupa string murni. Kalimat yang
//    dirakit di dalam template literal — `description={`${bank} akan dihapus
//    dari daftar.`}` atau `toast.show({ title: `@${handle} disimpan ke
//    favorit` })` — tidak pernah terlihat kamus: katalog hanya menyimpan
//    potongan literalnya, dan pengguna English membaca kalimat Indonesia di
//    momen paling penting (konfirmasi PIN/langganan). Polanya harus
//    `translate("… {x} …", { x })`.
//
//    Ambang "prosa" = >=2 kata berisi >=3 huruf, supaya bentuk teknis
//    (`${base}/orders/${id}`) dan satuan pendek tidak ikut tertangkap; panggilan
//    log pengembang (`[kahade/…]`) sengaja dilewatkan — itu bukan teks UI.
//
//    Pengecualian: label peta konstanta di SCOPE MODUL tidak bisa memanggil
//    `translate()` (bahasa akan membeku saat berkas dimuat). Bila bagian yang
//    berbeda HANYA angka, `maskNumbers` menormalkannya jadi token {x} sehingga
//    kunci kamus tetap sama dengan bentuk runtime — untuk kasus itu tulis
//    penanda `i18n-shape-aman: <alasan>` di atas barisnya.
{
  const TEXT_PROPS = new Set([
    "title", "titleIOS", "titleAndroid", "message", "description", "subtitle", "label",
    "helperText", "errorText", "errorMessage", "placeholder", "accessibilityLabel",
    "accessibilityHint", "hint", "caption", "trailing", "text", "confirmLabel", "cancelLabel",
    "actionLabel", "secondaryLabel", "retryLabel", "dismissLabel", "submitLabel", "emptyTitle",
    "emptyMessage", "emptyText", "loadingMessage", "leftLabel", "rightLabel", "okLabel",
    "headerTitle", "sheetTitle", "alt", "summary", "note", "groupLabel", "optionLabel",
    "valueLabel", "processingMessage", "successMessage", "failureMessage", "progressMessage",
  ])
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
      // SATU kata berhuruf >= 3 di luar slot sudah cukup: "… suka", "… periode",
      // "… rupiah", "… karakter" semuanya prosa yang harus lewat kamus. Bentuk
      // teknis (`${base}-${id}`, `${n}px`, `${x} MB`) tidak punya kata seperti itu.
      const isProse = (node) => {
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]
        return /\p{L}{3,}/u.test(parts.join(" "))
      }
      const markedNear = (node) => {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        const lines = sf.text.split("\n")
        // Penanda boleh di baris yang sama atau di blok komentar tepat di atasnya.
        for (let i = line; i >= 0 && i > line - 9; i--) {
          if (lines[i].includes("i18n-shape-aman:")) return true
          if (i < line && lines[i].trim().length > 0 && !lines[i].trimStart().startsWith("//")) break
        }
        return false
      }
      const inLogCall = (node) => {
        for (let p = node.parent, i = 0; p && i < 6; i++, p = p.parent) {
          if (ts.isCallExpression(p) && /log|console|Warn\b|Error\b|Info\b/i.test(p.expression.getText(sf)))
            return true
        }
        return false
      }
      /**
       * Telusuri SELURUH initializer prop a11y — bukan hanya induk langsung
       * template. Sebelumnya kasus `accessibilityLabel={summarize([`…rupiah`])}`
       * (template di dalam pemanggilan fungsi) lolos dari gate.
       */
      const checkA11yProp = (attr, propName) => {
        const init = attr.initializer
        if (!init) return
        const walkProp = (node) => {
          if (ts.isTemplateExpression(node) && isProse(node) && !inLogCall(node) && !markedNear(node)) {
            // Template di dalam translate() sudah ter-translate (pola benar).
            let inTranslate = false
            for (let p = node.parent; p; p = p.parent) {
              if (ts.isCallExpression(p) && /(^|\.)(translate|translateProp|t)$/.test(p.expression.getText(sf)))
                inTranslate = true
              if (ts.isJsxAttribute(p)) break
            }
            if (!inTranslate) {
              const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
              fail(
                `${rel}:${line}: template literal ber-prosa pada prop "${propName}" tidak ter-translate (G-01) — ` +
                  `kamus hanya melihat potongan literalnya, jadi pengguna English membaca kalimat Indonesia. ` +
                  `Pakai translate("… {x} …", { … }): ${node.getText(sf).replace(/\s+/g, " ").slice(0, 80)}`,
              )
            }
          }
          ts.forEachChild(node, walkProp)
        }
        walkProp(init)
      }
      const visit = (node) => {
        if (ts.isJsxAttribute(node) && node.initializer) {
          const name = node.name.getText(sf)
          if (TEXT_PROPS.has(name)) checkA11yProp(node, name)
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
