/**
 * Kahade — audit konflik class Tailwind di dalam satu className.
 *
 * MASALAH YANG DICARI (bug layout sistemik, dilaporkan QA 2026-09):
 * `cn()` (lib/cn.ts) sengaja hanya MENGGABUNG string, tidak men-merge. Jadi
 * `cn("shrink px-5 pt-2 pb-4", contentClassName)` dengan pemanggil yang
 * mengirim `contentClassName="px-0 pb-0"` menghasilkan className berisi
 * KEDUA kelas: `px-5 … px-0`. Pemenangnya bukan yang ditulis terakhir,
 * melainkan yang muncul paling akhir di CSS hasil Tailwind:
 *
 *   - web    : cascade CSS biasa — bukti: dist/_expo/static/css/web-*.css,
 *              `.px-0` (byte 16605) mendahului `.px-5` (byte 17142).
 *   - native : react-native-css-interop mengurutkan rule via
 *              `specificityCompare` dengan tie-break `SpecificityIndex.Order`
 *              (dist/runtime/native/native-interop.js:238-242, 569-597),
 *              yaitu urutan sumber CSS juga.
 *
 * Tailwind memancarkan utility satu kelompok dari skala terkecil
 * (`.px-0` … `.px-5`), jadi NILAI BESAR selalu mengalahkan nilai kecil:
 * `px-0` dikalahkan `px-5`, `pb-0` dikalahkan `pb-4`, `pt-0` oleh `pt-2`.
 * Gejalanya: padding default komponen menang atas override pemanggil, konten
 * menjorok ke kanan/kiri dan tidak sejajar judul di atasnya (BottomSheet,
 * ActionSheet, daftar chat, hasil pencarian transfer, …).
 *
 * CARA KERJA:
 *   1. Pindai app/**&/*.tsx + components/**&/*.tsx, kumpulkan semua literal
 *      className (termasuk argumen `cn(...)` dan prop *ClassName).
 *   2. Minta Tailwind (config repo sungguhan) meng-compile semua kelas itu,
 *      lalu baca CSS-nya: tiap kelas -> properti CSS yang di-set + urutan.
 *      Tidak ada daftar properti yang ditulis tangan → tidak bisa basi.
 *   3. Untuk setiap className, temukan pasangan kelas yang berbagi properti
 *      CSS tetapi pemenangnya BUKAN kelas yang ditulis paling akhir.
 *   4. Situs lintas komponen (`<BottomSheet contentClassName="px-0">` vs
 *      default `px-5` di dalam komponen) diselesaikan dengan memetakan prop
 *      -> default literal dari `cn("<literal>", …, <prop>)` di komponen itu.
 *
 * Pemakaian: node scripts/audit-class-conflicts.mjs [--check] [--json]
 *   --check : exit 1 bila ada temuan (untuk CI / npm run check)
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SCAN_DIRS = ["app", "components"]
const CHECK = process.argv.includes("--check")
const AS_JSON = process.argv.includes("--json")

/** Prop yang di-merge dengan default komponen (urutan = urutan merge). */
const CLASS_PROPS = [
  "className",
  "containerClassName",
  "contentClassName",
  "contentContainerClassName",
  "textClassName",
  "valueClassName",
  "thumbClassName",
  "trackClassName",
  "labelClassName",
  "iconClassName",
  "inputClassName",
  "rowClassName",
  "itemClassName",
  "headerClassName",
  "badgeClassName",
]

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", "dist"].includes(entry.name)) walk(full, out)
    } else if (entry.name.endsWith(".tsx")) {
      out.push(full)
    }
  }
  return out
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).sort()
const sources = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]))

/**
 * Kumpulkan literal class dari sebuah file: setiap string literal yang muncul
 * sebagai nilai prop *ClassName atau argumen `cn(...)`.
 * Mengembalikan [{ line, text, prop }] — `prop` null untuk argumen cn().
 */
function collectLiterals(file) {
  const src = sources.get(file)
  const found = []
  const push = (index, text, prop) => {
    const line = src.slice(0, index).split("\n").length
    found.push({ line, text, prop })
  }

  // 1) prop *ClassName="literal"  |  prop={cn("a", "b")}
  const propRe = new RegExp(`\\b(${CLASS_PROPS.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`, "g")
  let m
  while ((m = propRe.exec(src))) {
    const raw = m[2] ?? m[3] ?? m[4] ?? ""
    if (m[2] != null || m[3] != null) {
      push(m.index, raw, m[1])
    } else {
      for (const lit of extractStringLiterals(raw)) push(m.index, lit, m[1])
    }
  }

  // 2) argumen cn(...) di luar prop (mis. `const cls = cn("a", cond && "b")`)
  const cnRe = /\bcn\(/g
  while ((m = cnRe.exec(src))) {
    const args = readBalanced(src, m.index + m[1] + 1)
    if (args == null) continue
    for (const lit of extractStringLiterals(args)) push(m.index, lit, null)
  }
  return found
}

/** Baca isi di dalam kurung seimbang mulai dari `(` di `start`. */
function readBalanced(src, start) {
  if (src[start] !== "(") return null
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === "(") depth++
    else if (src[i] === ")") {
      depth--
      if (depth === 0) return src.slice(start + 1, i)
    }
  }
  return null
}

function extractStringLiterals(code) {
  const out = []
  const re = /"([^"\n]*)"|'([^'\n]*)'|`([^`\n$]*)`/g
  let m
  while ((m = re.exec(code))) out.push(m[1] ?? m[2] ?? m[3] ?? "")
  return out
}

/** Kelas -> properti CSS yang di-set + urutan sumber (diisi dari CSS Tailwind). */
const classInfo = new Map()

function buildClassMap(allClasses) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kahade-audit-"))
  const contentFile = path.join(tmp, "probe.html")
  const outFile = path.join(tmp, "out.css")
  // Satu kelas per baris: extractor Tailwind membaca apa adanya, termasuk
  // nilai arbitrary (px-[6px]) dan kelas bertanda (-mt-1).
  fs.writeFileSync(contentFile, [...allClasses].map((c) => `class="${c}"`).join("\n"))
  const res = spawnSync(
    "npx",
    ["tailwindcss", "-c", "tailwind.config.js", "-i", "global.css", "-o", outFile, "--content", contentFile],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
  if (res.status !== 0) {
    console.error("Tailwind gagal compile:\n" + (res.stderr || res.stdout))
    process.exit(2)
  }
  const css = fs.readFileSync(outFile, "utf8")

  let order = 0
  // Hanya rule di top level (variant/media query diabaikan: berbeda konteks).
  const ruleRe = /\.((?:[A-Za-z0-9_-]|\\.)+)\s*\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(css))) {
    const name = unescapeClass(m[1])
    const props = [...m[2].matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1])
    if (props.length === 0) continue
    const prev = classInfo.get(name)
    if (!prev) classInfo.set(name, { props: new Set(props), order: order++ })
    else for (const p of props) prev.props.add(p)
  }
  fs.rmSync(tmp, { recursive: true, force: true })
}

function unescapeClass(name) {
  return name.replace(/\\(.)/g, "$1")
}

/** Konflik: dua kelas berbagi properti CSS, tapi yang MENANG bukan yang terakhir ditulis. */
function findConflicts(classList) {
  const conflicts = []
  for (let i = 0; i < classList.length; i++) {
    const a = classInfo.get(classList[i])
    if (!a) continue
    for (let j = i + 1; j < classList.length; j++) {
      const b = classInfo.get(classList[j])
      if (!b) continue
      const shared = [...a.props].filter((p) => b.props.has(p))
      if (shared.length === 0) continue
      // `b` ditulis lebih akhir; bila urutan CSS-nya lebih kecil, `a` yang menang.
      if (a.order > b.order) conflicts.push({ winner: classList[i], loser: classList[j], props: shared })
    }
  }
  return conflicts
}

function splitClasses(text) {
  return text.split(/\s+/).filter(Boolean)
}

// ── Kumpulkan semua kelas yang perlu dipetakan ──────────────────────────────
const literalsByFile = new Map(files.map((f) => [f, collectLiterals(f)]))
const allClasses = new Set()
for (const list of literalsByFile.values()) for (const l of list) for (const c of splitClasses(l.text)) allClasses.add(c)
buildClassMap(allClasses)

// ── Temuan 1: konflik di dalam satu className statis ────────────────────────
const findings = []
for (const file of files) {
  for (const lit of literalsByFile.get(file)) {
    const classes = splitClasses(lit.text)
    for (const c of findConflicts(classes)) {
      findings.push({
        kind: "intra",
        file: path.relative(ROOT, file),
        line: lit.line,
        where: lit.prop ? `${lit.prop}="…"` : "cn(…)",
        ...c,
      })
    }
  }
}

// ── Temuan 2: default komponen vs literal yang dikirim pemanggil ────────────
/**
 * Dari `cn("<default literal>", …, <prop>)` di dalam komponen, petakan
 * (komponen, prop) -> default. Nama komponen = fungsi/const yang membungkus.
 */
/**
 * Nama yang benar-benar dipakai sebagai JSX di repo (`<Name`). Tanpa filter ini
 * const kapital non-komponen (mis. MAX_HEIGHT_RATIO, SHEET_COMMENT_LIMIT) ikut
 * terbaca sebagai "pemilik" cn() dan situs merge-nya hilang dari laporan.
 */
const jsxNames = new Set()
for (const file of files) {
  const src = sources.get(file)
  let m
  const re = /<([A-Z][A-Za-z0-9_]*)/g
  while ((m = re.exec(src))) jsxNames.add(m[1])
}

const defaults = new Map() // "Component.prop" -> { defaults, file, line }
for (const file of files) {
  const src = sources.get(file)
  // Hanya deklarasi level-atas (kolom 0): const lokal di dalam komponen
  // (mis. `const Wrapper = …` di BottomSheet) bukan pemilik prop className.
  const declRe = /(?:^|\n)(?:export\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g
  const decls = []
  let m
  while ((m = declRe.exec(src))) {
    if (jsxNames.has(m[1])) decls.push({ name: m[1], at: m.index })
  }
  const cnRe = /\bcn\(/g
  while ((m = cnRe.exec(src))) {
    const args = readBalanced(src, m.index + 2)
    if (args == null) continue
    const owner = [...decls].reverse().find((d) => d.at < m.index)?.name
    if (!owner) continue
    const lits = extractStringLiterals(args)
    if (lits.length === 0) continue
    // Prop yang di-merge = identifier di dalam argumen cn(...) yang namanya
    // salah satu CLASS_PROPS.
    for (const prop of CLASS_PROPS) {
      if (!new RegExp(`\\b${prop}\\b`).test(args)) continue
      const key = `${owner}.${prop}`
      if (defaults.has(key)) continue
      defaults.set(key, {
        defaults: lits.join(" "),
        file: path.relative(ROOT, file),
        line: src.slice(0, m.index).split("\n").length,
      })
    }
  }
}

/** Pindai `<Component … prop="literal" …>` di semua file. */
const usageRe = new RegExp(`<([A-Z][A-Za-z0-9_]*)((?:\\s+[\\s\\S]*?)?)\\s*/?>`, "g")
for (const file of files) {
  const src = sources.get(file)
  let m
  while ((m = usageRe.exec(src))) {
    const [, component, attrs] = m
    const line = src.slice(0, m.index).split("\n").length
    for (const prop of CLASS_PROPS) {
      const key = `${component}.${prop}`
      const def = defaults.get(key)
      if (!def) continue
      const attrRe = new RegExp(`\\b${prop}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`)
      const am = attrRe.exec(attrs)
      if (!am) continue
      const sent = am[1] ?? am[2] ?? ""
      const merged = [...splitClasses(def.defaults), ...splitClasses(sent)]
      for (const c of findConflicts(merged)) {
        // Hanya laporkan konflik LINTAS sisi (default vs kiriman pemanggil).
        const inDefault = splitClasses(def.defaults).includes(c.winner) || splitClasses(def.defaults).includes(c.loser)
        const inSent = splitClasses(sent).includes(c.winner) || splitClasses(sent).includes(c.loser)
        if (!(inDefault && inSent)) continue
        findings.push({
          kind: "cross",
          file: path.relative(ROOT, file),
          line,
          where: `<${component} ${prop}="${sent}">`,
          componentFile: def.file,
          componentLine: def.line,
          ...c,
        })
      }
    }
  }
}

// ── Temuan 3: padding horizontal bertumpuk pada wrapper yang sudah padded ───
/*
 * Pola kedua di balik keluhan "konten menjorok ke kanan" (berbeda dari konflik
 * class: di sini TIDAK ada kelas yang saling menimpa, keduanya benar-benar
 * diterapkan sehingga padding-nya JUMLAH).
 *
 * Wrapper yang sudah memberi screen padding sendiri:
 *   - `footer` <Screen>  -> <FooterBar> `px-5 pt-4` (components/ui/footer-bar.tsx:61)
 *   - `footer` <BottomSheet> -> wrapper footer `px-5 pt-4` (bottom-sheet.tsx:341)
 *   - `padded` <PaginatedList> default true -> paddingHorizontal screenPaddingX
 *     (paginated-list.tsx:132)
 * Jadi padding horizontal apa pun di dalam ekspresi `footer={…}` selalu dobel.
 */
const stacked = []
for (const file of files) {
  const src = sources.get(file)
  const re = /\bfooter=\{/g
  let m
  while ((m = re.exec(src))) {
    // Ambil isi `footer={ … }` sampai kurung kurawal seimbang.
    let depth = 0
    let end = -1
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === "{") depth++
      else if (src[i] === "}") {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) continue
    const body = src.slice(m.index + m[0].length - 1, end)
    // HANYA tag terluar footer yang bisa dobel dengan padding wrapper: chip /
    // tombol di dalamnya wajar punya px-* sendiri.
    const open = body.search(/<[A-Za-z]/)
    if (open < 0) continue
    let tagEnd = -1
    let braces = 0
    for (let i = open; i < body.length; i++) {
      if (body[i] === "{") braces++
      else if (body[i] === "}") braces--
      else if (body[i] === ">" && braces === 0) {
        tagEnd = i
        break
      }
    }
    if (tagEnd < 0) continue
    const openTag = body.slice(open, tagEnd)
    const hits = [...new Set([...openTag.matchAll(/\b(?:px|pl|pr)-(?:[0-9.]+|\[[^\]]+\])/g)].map((x) => x[0]))]
    if (hits.length === 0) continue
    stacked.push({
      file: path.relative(ROOT, file),
      line: src.slice(0, m.index).split("\n").length,
      hits,
    })
  }
}

// ── Laporan ─────────────────────────────────────────────────────────────────
/*
 * Sejak lib/cn.ts men-merge (tailwind-merge), konflik yang melewati `cn()`
 * SEMBUH: yang ditulis terakhir menang. Temuan lintas komponen di bawah selalu
 * berasal dari situs `cn(...)` (itulah cara audit ini menemukannya), jadi
 * statusnya "resolved" — dicetak sebagai informasi, tidak menggagalkan CI.
 * Yang menggagalkan (`--check`) hanyalah konflik yang TIDAK lewat cn():
 * dua kelas bertentangan di dalam satu literal className mentah.
 */
const unique = []
const seen = new Set()
for (const f of findings) {
  const key = `${f.kind}|${f.file}|${f.line}|${f.winner}|${f.loser}`
  if (seen.has(key)) continue
  seen.add(key)
  unique.push({ ...f, resolved: f.kind === "cross" || f.where.startsWith("cn(") })
}
unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
const unresolved = unique.filter((f) => !f.resolved)

if (AS_JSON) {
  console.log(JSON.stringify({ conflicts: unique, stackedFooterPadding: stacked }, null, 2))
} else {
  console.log(`Kelas yang dipetakan dari config Tailwind repo : ${classInfo.size}`)
  console.log(`File dipindai                                : ${files.length}`)
  console.log(`Konflik class (sudah diselesaikan cn())       : ${unique.length - unresolved.length}`)
  console.log(`Konflik class TANPA cn() -> masih rusak       : ${unresolved.length}`)
  console.log(`Padding horizontal dobel di footer            : ${stacked.length}\n`)
  for (const f of unique) {
    const props = f.props.join(", ")
    const tag = f.resolved ? "resolved-by-cn" : "RUSAK"
    if (f.kind === "intra") {
      console.log(`${f.file}:${f.line}  [${f.where}] (${tag})`)
      console.log(`    "${f.winner}" mengalahkan "${f.loser}" (properti: ${props})`)
    } else {
      console.log(`${f.file}:${f.line}  ${f.where} (${tag})`)
      console.log(
        `    default ${f.componentFile}:${f.componentLine} → "${f.winner}" vs kiriman "${f.loser}" (properti: ${props})`,
      )
    }
  }
  for (const f of stacked) {
    console.log(`${f.file}:${f.line}  footer={…} (RUSAK — padding dobel)`)
    console.log(`    ${f.hits.join(" ")} di atas padding px-5 milik FooterBar/wrapper footer sheet`)
  }
}

if (CHECK && (unresolved.length > 0 || stacked.length > 0)) {
  console.error(
    `\n${unresolved.length} konflik class tanpa cn() + ${stacked.length} padding dobel di footer. ` +
      "Lihat kepala scripts/audit-class-conflicts.mjs.",
  )
  process.exit(1)
}

