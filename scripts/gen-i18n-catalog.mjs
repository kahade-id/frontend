/**
 * Kahade — generator katalog string UI (i18n).
 *
 * Memindai sumber dengan AST TypeScript, mengumpulkan SEMUA string yang bisa
 * sampai ke mata user, dan menulis `lib/i18n/catalog.json`. Katalog inilah yang
 * menjadi daftar kerja penerjemah + dasar `check:i18n` (CI gagal kalau ada
 * string UI baru yang tidak masuk katalog, sehingga "layar setengah Inggris"
 * tidak bisa lolos diam-diam).
 *
 * Aturan pemisahan (non-obvious):
 *  - Diambil: children JSX, atribut JSX dengan nama bertipe TEKS, properti
 *    object literal dengan nama bertipe teks (mis. `{ title, description }`
 *    pada `toast.show`), dan string argumen `Alert.alert`/`announceForAccessibility`.
 *  - Dibuang: token teknis (`className`, `variant`, route, warna, enum
 *    lowercase), karena kalau ikut diterjemahkan justru merusak styling/route.
 *  - Template literal (`Saldo ${amount} keluar`) disimpan sebagai BENTUK dengan
 *    token {x} — lihat lib/i18n/shape.ts; codegen dan runtime memakai fungsi
 *    normalisasi yang sama, jadi kunci tidak pernah bergeser.
 *
 * Pemakaian:
 *   npm run gen:i18n          # tulis catalog.json + lapor cakupan kamus
 *   npm run check:i18n        # gagal bila katalog usang / string tak terjemahkan
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

import { collapse, shapeOf, SLOT_TOKEN } from "../lib/i18n/shape.ts"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SCAN_DIRS = ["app", "components", "lib"]
const SKIP = [/^lib\/i18n\//, /(^|\/)i18n\//, /\.test\.tsx?$/, /\.d\.ts$/]

/** Nama prop/atribut yang isinya teks untuk user. */
const TEXT_PROPS = new Set([
  "title", "titleIOS", "titleAndroid", "message", "messageIOS", "description", "subtitle",
  "label", "helperText", "errorText", "errorMessage", "placeholder", "accessibilityLabel",
  "accessibilityHint", "hint", "caption", "trailing", "text", "confirmLabel", "cancelLabel",
  "actionLabel", "secondaryLabel", "retryLabel", "dismissLabel", "submitLabel", "emptyTitle",
  "descriptionText", "emptyMessage", "emptyText", "loadingMessage", "leftLabel", "rightLabel",
  "okLabel", "headerTitle", "sheetTitle", "alt", "summary", "note", "unit", "sectionTitle",
  "groupLabel", "optionLabel", "valueLabel", "prefixText", "suffixText", "tooltip", "aria-label",
])

/** Nama prop yang meski ada di objek config tidak pernah tampil sebagai teks. */
const NEVER_TEXT = new Set([
  "id", "key", "testID", "name", "icon", "leftIcon", "rightIcon", "href", "route", "source",
  "variant", "tone", "size", "type", "value", "defaultValue", "className", "style", "color",
  "width", "height", "weight", "ellipsizeMode", "numberOfLines", "maxLength", "minLength",
  "keyboardType", "autoCapitalize", "inputMode", "textContentType", "returnKeyType",
  "accessibilityRole", "accessibilityState", "accessibilityLiveRegion", "edges", "channelId",
])

/** String yang jelas bukan prosa UI. */
function isTechnical(value) {
  const s = value.trim()
  if (s.length === 0) return true
  if (!/\p{L}/u.test(s)) return true // angka/simbol saja
  if (s.length <= 1) return true
  if (/^[/#.]/.test(s)) return true // route, id, warna
  if (/^[a-z0-9]+([._/-][a-z0-9]+)*$/.test(s)) return true // token teknis lowercase
  if (/^[A-Z][A-Z0-9_]*$/.test(s)) return true // CONSTANT_CASE
  if (/\s(dark|light):|^[a-z-]+-\d+$/.test(s)) return true // class tailwind
  // Deretan token class (font-sans-{x} tabular-nums): semua suku kata kecil +
  // tanda hubung, tidak ada spasi setelah koma, tidak ada huruf besar.
  if (/^[a-z0-9{}\-_.\s]+$/.test(s) && /^[a-z0-9{}_-]+([ ][a-z0-9{}_-]+)*$/.test(s) && /[a-z]-[a-z0-9{}]/.test(s))
    return true
  // Cuplikan kode/error internal (mis. pesan di `lib/api/client.ts`): bukan
  // teks user, jangan pernah masuk kamus.
  if (/[<>{};=]|=>|\b(const|let|var|function|await|async|import|export|Promise|void|undefined|null|readonly|interface|type|schema|http)\b|[A-Za-z_$][A-Za-z0-9_$]*\([^)]*\)/.test(s))
    return true
  if (/^[-\d.,\s]+$/.test(s)) return true
  // Tanda kurung tak seimbang = cuplikan kode (`(path,`), bukan kalimat user.
  if (((s.match(/\(/g) ?? []).length) !== ((s.match(/\)/g) ?? []).length)) return true
  return false
}

function* walk(dir) {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(p)) yield p
  }
}

/** Kunci kamus: bentuk ternormalisasi (angka → {x}). */
const found = new Map()

function addCandidate(raw, file, kind) {
  const clean = collapse(raw)
  if (!clean) return
  const { shape } = shapeOf(clean)
  if (isTechnical(clean) && !raw.includes(SLOT_TOKEN)) return
  const prev = found.get(shape)
  if (prev) {
    prev.count += 1
    prev.files.add(file)
    prev.kinds.add(kind)
  } else {
    found.set(shape, { shape, count: 1, files: new Set([file]), kinds: new Set([kind]) })
  }
}

/** Ambil string literal / template dari ekspresi (termasuk di dalam ternary). */
function collectStrings(node, sf, file, kind, depth = 0) {
  if (!node || depth > 4) return
  if (ts.isStringLiteralLike(node)) {
    addCandidate(node.text, file, kind)
    return
  }
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text
    for (const span of node.templateSpans) {
      // Ekspresi numeric sederhana (${n}, ${count}) vs apa pun → selalu SLOT,
      // runtime mengisi ulang urutannya.
      out += SLOT_TOKEN + span.literal.text
    }
    addCandidate(out, file, kind)
    return
  }
  if (
    ts.isConditionalExpression(node) ||
    ts.isBinaryExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isPrefixUnaryExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression?.(node) ||
    ts.isNonNullExpression(node)
  ) {
    node.forEachChild((child) => {
      if (ts.isExpressionStatement(child)) return
      collectStrings(child, sf, file, kind, depth + 1)
    })
    return
  }
  if (ts.isCallExpression(node)) {
    const fn = node.expression.getText(sf)
    if (/Alert\.alert|announceForAccessibility|show\(|setString\(/.test(fn)) {
      for (const arg of node.arguments) {
        if (ts.isObjectLiteralExpression(arg)) collectObjectStrings(arg, sf, file)
        else collectStrings(arg, sf, file, kind, depth + 1)
      }
    }
  }
}

function collectObjectStrings(objNode, sf, file) {
  for (const prop of objNode.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = prop.name.getText(sf).replace(/^["']|["']$/g, "")
    if (NEVER_TEXT.has(name)) continue
    if (!TEXT_PROPS.has(name)) continue
    collectStrings(prop.initializer, sf, file, name)
  }
}

for (const dir of SCAN_DIRS) {
  const abs = join(root, dir)
  if (!existsSync(abs)) continue
  for (const file of walk(abs)) {
    const rel = relative(root, file).split("\\").join("/")
    if (SKIP.some((re) => re.test(rel))) continue
    const text = readFileSync(file, "utf8")
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

    const visit = (node) => {
      if (ts.isJsxText(node)) {
        addCandidate(node.text, rel, "jsx-text")
      } else if (ts.isJsxAttribute(node) && node.initializer) {
        const name = node.name.getText(sf)
        if (!NEVER_TEXT.has(name) && TEXT_PROPS.has(name)) {
          collectStrings(node.initializer, sf, rel, name)
        }
      } else if (ts.isObjectLiteralExpression(node)) {
        collectObjectStrings(node, sf, rel)
      } else if (ts.isCallExpression(node)) {
        collectStrings(node, sf, rel, "call")
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
}

const entries = [...found.values()]
  .map((e) => ({ shape: e.shape, count: e.count, files: [...e.files].sort(), kinds: [...e.kinds].sort() }))
  .sort((a, b) => b.count - a.count || a.shape.localeCompare(b.shape, "id"))

const outPath = join(root, "lib/i18n/catalog.json")
const payload = `${JSON.stringify(
  {
    // Dihasilkan oleh scripts/gen-i18n-catalog.mjs — JANGAN sunting manual.
    generatedBy: "scripts/gen-i18n-catalog.mjs",
    sourceLanguage: "id",
    strings: entries.map((e) => ({ s: e.shape, n: e.count })),
  },
  null,
  1,
)}\n`

if (process.argv.includes("--areas")) {
  // Alat bantu penerjemah: kunci yang sama muncul di banyak layar → kelompokkan
  // berdasarkan file sumber pertama, supaya satu layar bisa diterjemahkan tuntas
  // (layar setengah Inggris/setengah Indonesia lebih buruk daripada penuh satu).
  const areaOf = (file) => {
    if (file.startsWith("components/")) return "ui"
    if (file.startsWith("lib/")) return "labels"
    if (file.startsWith("app/(auth)")) return "auth"
    if (file.startsWith("app/(tabs)")) return "tabs"
    if (file.startsWith("app/")) return "screens"
    return "misc"
  }
  // {s, n} per area, string TERBANYAK dipakai lebih dulu — supaya kamus yang
  // masih setengah jalan sudah menutupi teks yang paling sering muncul.
  const groups = new Map()
  const outDir = join(root, "node_modules/.cache/kahade-i18n")
  mkdirSync(outDir, { recursive: true })
  for (const e of found.values()) {
    const area = areaOf([...e.files].sort()[0] ?? "")
    if (!groups.has(area)) groups.set(area, [])
    groups.get(area).push({ s: e.shape, n: e.count })
  }
  for (const [area, list] of [...groups].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    const out = join(outDir, `area-${area}.json`)
    const uniq = [...new Map(list.map((x) => [x.s, x])).values()].sort(
      (a, b) => b.n - a.n || a.s.localeCompare(b.s, "id"),
    )
    writeFileSync(out, JSON.stringify(uniq, null, 1))
    console.log(`${area}: ${uniq.length} → ${relative(root, out)}`)
  }
}

if (process.argv.includes("--list")) {
  // Alat bantu penerjemah: daftar string per area, TIDAK ditulis ke file.
  // {s, n} per area, string TERBANYAK dipakai lebih dulu — supaya kamus yang
  // masih setengah jalan sudah menutupi teks yang paling sering muncul.
  const groups = new Map()
  const outDir = join(root, "node_modules/.cache/kahade-i18n")
  mkdirSync(outDir, { recursive: true })
  for (const e of found.values()) {
    const first = [...e.files][0] ?? "?"
    const area = first.startsWith("components/") ? "components" : first.split("/").slice(0, 2).join("/")
    if (!groups.has(area)) groups.set(area, [])
    groups.get(area).push(e)
  }
  for (const [area, list] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n##### ${area} (${list.length})`)
    for (const e of list.sort((a, b) => b.count - a.count || a.shape.localeCompare(b.shape, "id")))
      console.log(JSON.stringify(e.shape))
  }
  console.log(`\ntotal: ${found.size}`)
}

if (process.argv.includes("--check")) {
  const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : ""
  if (current !== payload) {
    console.error(
      `Katalog i18n usang. Ada string UI baru yang belum tercatat. Jalankan: npm run gen:i18n`,
    )
    const before = current ? JSON.parse(current).strings.length : 0
    console.error(`  katalog: ${before} string → seharusnya: ${entries.length}`)
    process.exit(1)
  }
  console.log(`Katalog i18n sinkron (${entries.length} string).`)
} else {
  writeFileSync(outPath, payload)
  console.log(`lib/i18n/catalog.json ditulis — ${entries.length} string UI.`)
  const withTokens = entries.filter((e) => e.shape.includes("{x}"))
  console.log(`  ${withTokens.length} di antaranya mengandung nilai runtime ({x}).`)
}
