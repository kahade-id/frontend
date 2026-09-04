#!/usr/bin/env node
/**
 * audit(#12) — Sinkronisasi tiga sumber token.
 *
 * Arsitektur repo ini sudah "satu sumber kebenaran":
 *   lib/tokens.ts ──toTailwindTheme()──▶ tailwind.config.js (theme.extend)
 *                 ──toCssVariables()──▶ ThemeProvider → vars() runtime
 *   global.css     : hanya @tailwind directives, TIDAK mendeklarasikan --color-*
 *
 * Jadi yang bisa drift bukan nilai (selalu dari tokens.ts) melainkan KONTRAK
 * antar adapter. Skrip ini memeriksa:
 *
 *  1. Setiap `var(--x)` yang dirujuk theme Tailwind di-emit oleh
 *     toCssVariables() untuk light DAN dark (kalau tidak: class ada tapi
 *     warnanya kosong → styling hilang diam-diam).
 *  2. Setiap var yang di-emit dirujuk oleh theme (orphan = dead token).
 *  3. Set key light == set key dark, dan setiap key ModeTokens + semantic
 *     {fill,text,bgSoft} punya CSS var.
 *  4. Nilai warna valid (#RGB/#RRGGBB atau rgba()).
 *  5. global.css tidak mendeklarasikan --color-* (harus tetap runtime-only,
 *     kalau tidak akan ada dua sumber nilai).
 *  6. Literal "--color-*" / var(--color-*) di components/, app/, lib/ hanya
 *     merujuk var yang benar-benar di-emit (contoh: scope override di
 *     subscription-plan-card).
 *  7. tailwind.config.js tidak menyelipkan warna literal di luar tokens.ts.
 *  8. (audit #9, #13) app.json: splash backgroundColor == light.background,
 *     splash dark.backgroundColor == dark.background (wajib), dan
 *     expo-notifications color == light.primary — konfigurasi native tidak
 *     bisa import tokens.ts, jadi literalnya diverifikasi di sini.
 *  9. (audit #13) className `dark:*` dan class warna literal non-mode-aware
 *     (text-white, bg-white, bg-black, *-gray-N) hanya di file allowlist yang
 *     pengecualiannya terdokumentasi dengan §spek.
 *
 * Jalankan: pnpm check:tokens   (butuh Node >= 22.6 untuk memuat .ts)
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `check-tokens: butuh Node >= 22.6 (type stripping) untuk memuat lib/tokens.ts, terdeteksi ${process.versions.node}.`,
  )
  process.exit(2)
}

const tokens = await import(join(root, "lib/tokens.ts"))
const { toTailwindTheme, toCssVariables, light, dark, semantic } = tokens

const errors = []
const warnings = []
const fail = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)

// ------------------------------------------------------------------
// Kumpulkan var yang DIRUJUK theme Tailwind (recursive walk)
// ------------------------------------------------------------------
const VAR_RE = /var\((--[a-z0-9-]+)\)/g
const referenced = new Set()
function walk(node, path = []) {
  if (typeof node === "string") {
    for (const m of node.matchAll(VAR_RE)) referenced.add(m[1])
    return
  }
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, [...path, i]))
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, [...path, k])
  }
}
const theme = toTailwindTheme()
walk(theme)

// ------------------------------------------------------------------
// Kumpulkan var yang DI-EMIT per mode
// ------------------------------------------------------------------
const lightVars = toCssVariables("light")
const darkVars = toCssVariables("dark")
const emittedLight = new Set(Object.keys(lightVars))
const emittedDark = new Set(Object.keys(darkVars))

// 1. referenced ⊆ emitted (light & dark)
for (const v of referenced) {
  if (!emittedLight.has(v)) fail(`theme merujuk ${v} tapi toCssVariables("light") tidak meng-emit-nya`)
  if (!emittedDark.has(v)) fail(`theme merujuk ${v} tapi toCssVariables("dark") tidak meng-emit-nya`)
}

// 2. emitted ⊆ referenced (orphan). Dicek juga pemakaian literal di source
//    (langkah 6) — var yang tidak dirujuk theme TAPI dipakai langsung lewat
//    vars() masih dianggap hidup.
const usedInSource = new Set()

// 3. light == dark, dan cakupan ModeTokens + semantic
const lightKeys = Object.keys(light).sort()
const darkKeys = Object.keys(dark).sort()
if (lightKeys.join() !== darkKeys.join()) {
  fail(
    `key ModeTokens light vs dark berbeda:\n    light-only: ${lightKeys.filter((k) => !darkKeys.includes(k))}\n    dark-only : ${darkKeys.filter((k) => !lightKeys.includes(k))}`,
  )
}
if (emittedLight.size !== emittedDark.size || [...emittedLight].some((k) => !emittedDark.has(k))) {
  fail("toCssVariables(light) dan toCssVariables(dark) meng-emit set var yang berbeda")
}
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
for (const k of lightKeys) {
  const cssName = `--color-${kebab(k)}`
  if (!emittedLight.has(cssName)) fail(`ModeTokens.${k} tidak punya CSS var (${cssName} diharapkan)`)
  else if (lightVars[cssName] !== light[k]) fail(`${cssName} (light) = ${lightVars[cssName]} ≠ light.${k} = ${light[k]}`)
  if (emittedDark.has(cssName) && darkVars[cssName] !== dark[k]) fail(`${cssName} (dark) = ${darkVars[cssName]} ≠ dark.${k} = ${dark[k]}`)
}
const semanticSuffix = { fill: "fill", text: "text", bgSoft: "soft" }
for (const [name, byMode] of Object.entries(semantic)) {
  for (const [prop, suffix] of Object.entries(semanticSuffix)) {
    const cssName = `--color-${name}-${suffix}`
    if (!emittedLight.has(cssName)) {
      fail(`semantic.${name}.${prop} tidak punya CSS var (${cssName} diharapkan)`)
      continue
    }
    if (lightVars[cssName] !== byMode.light[prop]) fail(`${cssName} (light) ≠ semantic.${name}.light.${prop}`)
    if (darkVars[cssName] !== byMode.dark[prop]) fail(`${cssName} (dark) ≠ semantic.${name}.dark.${prop}`)
  }
}

// 4. Nilai valid
const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\([^)]+\))$/i
for (const [mode, vars] of [
  ["light", lightVars],
  ["dark", darkVars],
]) {
  for (const [k, v] of Object.entries(vars)) {
    if (!COLOR_RE.test(v)) fail(`${k} (${mode}) bukan warna valid: "${v}"`)
  }
}

// 5. global.css tidak mendeklarasikan --color-*
const css = readFileSync(join(root, "global.css"), "utf8")
const cssDecl = css.replace(/\/\*[\s\S]*?\*\//g, "") // buang komentar
for (const m of cssDecl.matchAll(/(--color-[a-z0-9-]+)\s*:/g)) {
  fail(`global.css mendeklarasikan ${m[1]} — nilai warna harus hanya dari toCssVariables() (runtime), bukan CSS statis`)
}
for (const directive of ["@tailwind base", "@tailwind components", "@tailwind utilities"]) {
  if (!cssDecl.includes(directive)) fail(`global.css kehilangan "${directive}"`)
}

// 6. Literal --color-* di source
const SRC_DIRS = ["components", "app", "lib", "features", "hooks"]
const SRC_EXT = /\.(tsx?|jsx?)$/
function* files(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (e === "node_modules" || e.startsWith(".")) continue
      yield* files(p)
    } else if (SRC_EXT.test(e)) yield p
  }
}
const LITERAL_RE = /["'`](--color-[a-z0-9-]+)["'`]|var\((--color-[a-z0-9-]+)\)/g
for (const dir of SRC_DIRS) {
  for (const f of files(join(root, dir))) {
    if (f.endsWith("lib/tokens.ts")) continue
    const src = readFileSync(f, "utf8")
    for (const m of src.matchAll(LITERAL_RE)) {
      const v = m[1] ?? m[2]
      usedInSource.add(v)
      if (!emittedLight.has(v)) fail(`${relative(root, f)} memakai ${v} yang tidak di-emit toCssVariables()`)
    }
  }
}
for (const v of emittedLight) {
  if (!referenced.has(v) && !usedInSource.has(v)) warn(`${v} di-emit tapi tidak dirujuk theme Tailwind maupun source (orphan)`)
}

// 7. tailwind.config.js tanpa warna literal
const twSrc = readFileSync(join(root, "tailwind.config.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
for (const m of twSrc.matchAll(/#[0-9a-f]{3,8}\b|rgba?\(/gi)) {
  fail(`tailwind.config.js memuat warna literal "${m[0]}" — pindahkan ke lib/tokens.ts`)
}
if (!/toTailwindTheme\(\)/.test(twSrc)) fail("tailwind.config.js tidak memanggil toTailwindTheme() — theme tidak lagi digenerate dari tokens.ts")

// 8. app.json (audit #9): warna native di konfigurasi Expo tidak bisa
//    mengimpor tokens.ts, jadi literalnya WAJIB sama dengan token acuan.
//    - splash backgroundColor == light.background: <AnimatedSplash> memakai
//      tokens.colors.light.background; kalau beda, handoff native→JS kedip.
//    - expo-notifications color == light.primary (aksen ikon notif Android).
const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8"))
const plugins = appJson.expo?.plugins ?? []
const pluginOpts = (name) => plugins.find((p) => Array.isArray(p) && p[0] === name)?.[1]
const eqColor = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase()

const splash = pluginOpts("expo-splash-screen")
if (!splash) {
  fail("app.json: plugin expo-splash-screen tanpa opsi — backgroundColor harus eksplisit agar sama dengan tokens.colors.light.background")
} else {
  if (!eqColor(splash.backgroundColor, light.background)) {
    fail(`app.json: splash backgroundColor ${splash.backgroundColor} != tokens.colors.light.background ${light.background} (dipakai components/ui/animated-splash.tsx)`)
  }
  // (audit #13) <AnimatedSplash> membaca useColorScheme() dan memakai
  // tokens.colors.dark.background di OS dark; native splash WAJIB punya
  // pasangan dark agar handoff tidak kedip putih→hitam.
  if (!splash.dark?.backgroundColor) {
    fail(`app.json: splash tanpa dark.backgroundColor — wajib ${dark.background} (tokens.colors.dark.background) karena <AnimatedSplash> mengikuti OS dark`)
  } else if (!eqColor(splash.dark.backgroundColor, dark.background)) {
    fail(`app.json: splash dark.backgroundColor ${splash.dark.backgroundColor} != tokens.colors.dark.background ${dark.background}`)
  }
}
const notif = pluginOpts("expo-notifications")
if (notif?.color && !eqColor(notif.color, light.primary)) {
  fail(`app.json: expo-notifications color ${notif.color} != tokens.colors.light.primary ${light.primary}`)
}

// 9. (audit #13) Dark mode ditangani token (CSS var), BUKAN class. Dua hal
//    yang bisa menembus model itu dan diam-diam rusak di dark:
//    - varian `dark:` di className (mode di-resolve per class, bukan per token)
//    - class warna literal yang tidak mode-aware: text-white/bg-white/bg-black/
//      text-black dan skala gray-N mentah (bg-gray-300, text-gray-950, ...)
//    Keduanya hanya boleh di file yang ada di allowlist di bawah, masing-masing
//    dengan alasan §spek di komentar dekat kode. File baru yang memakainya
//    → FAIL (tambahkan ke allowlist + tulis alasannya, atau ganti ke token).
//    Entri allowlist yang tidak lagi terpakai → warn (bersihkan).
const DARK_ALLOWLIST = {
  // Teks di atas fill danger: putih di light, gray-950 di dark karena fill
  // dark (#F87171) terlalu terang untuk teks putih (< AA). Pola bersama.
  "components/ui/button.tsx": "destructive text-white dark:text-gray-950 (AA di atas danger fill)",
  "components/ui/count-badge.tsx": "danger text-white dark:text-gray-950 — ikut Button destructive",
  "components/ui/swipeable-list-item.tsx": "aksi destruktif text-white dark:text-gray-950 — ikut Button destructive",
  // Skala monokrom chart harus dibalik di dark supaya urutan kontras tetap.
  "components/ui/bar-chart.tsx": "chartMono gray-400/600/800 → dark:gray-700/500/300 (§2.3 chart monokrom)",
  // Divider subtle: gray-300 dekoratif di light, di dark jatuh ke border token.
  "components/ui/divider.tsx": "subtle bg-gray-300 dark:bg-border (§6.1)",
  // Skeleton: surface di light terlalu dekat background di dark → naik satu level.
  "components/ui/skeleton.tsx": "bg-surface dark:bg-surface-elevated (§8 loading)",
  // §3.2: H1/H2 turun satu tingkat weight di dark (700 → 600).
  "components/ui/text.tsx": "h1/h2 dark:font-sans-600 (§3.2 fontWeightDark)",
  // §7: logo bank berwarna di tile putih; border-border memisahkannya di dark.
  "components/ui/bank-select.tsx": "tile logo bg-white + border-border (§7 pengecualian monokrom)",
  // Teks di atas scrim bg-overlay (selalu hitam di dua mode) — putih adalah satu-satunya yang terbaca.
  "components/ui/showcase-gallery-grid.tsx": "+N text-white di atas bg-overlay (scrim hitam kedua mode)",
}
const DARK_VARIANT_RE = /\bdark:[a-z][a-z0-9-]*/g
const LITERAL_CLASS_RE = /\b(?:bg|text|border|fill|stroke)-(?:white|black|gray-\d{2,3})\b/g
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"`])\/\/[^\n]*/g, "$1")
const darkSeen = new Set()
for (const dir of ["components", "app"]) {
  for (const f of files(join(root, dir))) {
    const rel = relative(root, f)
    const src = stripComments(readFileSync(f, "utf8"))
    const hits = [
      ...[...src.matchAll(DARK_VARIANT_RE)].map((m) => m[0]),
      ...[...src.matchAll(LITERAL_CLASS_RE)].map((m) => m[0]),
    ]
    if (!hits.length) continue
    darkSeen.add(rel)
    if (!(rel in DARK_ALLOWLIST)) {
      fail(
        `${rel} memakai ${[...new Set(hits)].join(", ")} — dark mode harus lewat token (bg-surface, text-text-primary, ...), bukan class dark:/warna literal. Kalau memang pengecualian, tambahkan ke DARK_ALLOWLIST (scripts/check-tokens.mjs) + komentar §spek di kode.`,
      )
    }
  }
}
for (const rel of Object.keys(DARK_ALLOWLIST)) {
  if (!darkSeen.has(rel)) warn(`DARK_ALLOWLIST: ${rel} tidak lagi memakai dark:/warna literal — hapus entrinya`)
}

// 10. (audit #6) Kontras WCAG per pasangan token yang dipakai komponen.
//     Dihitung dari nilai token (bukan dari class), jadi mengubah satu hex di
//     tokens.ts yang membuat pasangan jatuh di bawah ambang → FAIL.
//     Ambang: teks normal 4.5:1 (1.4.3), teks besar/ikon/UI component 3:1
//     (1.4.11). `borderDefault` dan `textDisabled` SENGAJA tidak diuji ke
//     ambang tinggi — keduanya pengecualian yang terdokumentasi di tokens.ts
//     (dekoratif / state disabled), tapi tetap dijaga agar tidak turun lagi.
function luminance(hex) {
  const c = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contrast(a, b) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const CONTRAST_PAIRS = [
  // [fg, bg, min, alasan]
  ["textPrimary", "background", 4.5, "teks utama (1.4.3)"],
  ["textPrimary", "surface", 4.5, "teks utama di card (1.4.3)"],
  ["textSecondary", "background", 4.5, "body/caption/label (1.4.3)"],
  ["textSecondary", "surface", 4.5, "body/caption di card + placeholder Input (1.4.3)"],
  ["textTertiary", "background", 3, "ikon & teks besar (1.4.11 / 1.4.3 large)"],
  ["textTertiary", "surface", 3, "ikon di card (1.4.11)"],
  ["borderControl", "background", 3, "outline form control resting (1.4.11)"],
  ["borderControl", "surface", 3, "outline form control di atas card (1.4.11)"],
  ["borderFocus", "background", 3, "indikator fokus (1.4.11)"],
  ["borderError", "background", 3, "indikator error (1.4.11)"],
  ["primary", "background", 3, "Switch on / Radio selected / Checkbox checked (1.4.11)"],
  ["primaryForeground", "primary", 4.5, "label Button primary (1.4.3)"],
  // Pengecualian yang dijaga supaya tidak memburuk (bukan syarat WCAG):
  ["borderDefault", "background", 1.3, "card/divider dekoratif — harus tetap terlihat"],
  // Light: elevated == background (putih) SENGAJA, dipisah border (§6). Di dark
  // tidak ada border pada skeleton, jadi warnanya sendiri yang harus membedakan.
  ["surfaceElevated", "background", 1.3, "skeleton/sheet harus terbedakan dari background", "dark"],
]
for (const mode of ["light", "dark"]) {
  const t = mode === "light" ? light : dark
  for (const [fg, bg, min, why, onlyMode] of CONTRAST_PAIRS) {
    if (onlyMode && onlyMode !== mode) continue
    const r = contrast(t[fg], t[bg])
    if (r < min) {
      fail(`kontras ${mode} ${fg} (${t[fg]}) / ${bg} (${t[bg]}) = ${r.toFixed(2)}:1 < ${min}:1 — ${why}`)
    }
  }
  for (const [name, byMode] of Object.entries(semantic)) {
    const s = byMode[mode]
    const rText = contrast(s.text, s.bgSoft)
    if (rText < 4.5) fail(`kontras ${mode} semantic.${name}.text / bgSoft = ${rText.toFixed(2)}:1 < 4.5:1 (label Badge/Alert)`)
    const rFill = contrast(s.fill, t.surface)
    if (rFill < 3) fail(`kontras ${mode} semantic.${name}.fill / surface = ${rFill.toFixed(2)}:1 < 3:1 (ikon/dot status, 1.4.11)`)
  }
}

// ------------------------------------------------------------------
// Laporan
// ------------------------------------------------------------------
console.log(
  `check-tokens: ${referenced.size} var dirujuk theme, ${emittedLight.size} var di-emit per mode, ${usedInSource.size} var dipakai literal di source`,
)
for (const w of warnings) console.warn(`  warn  ${w}`)
for (const e of errors) console.error(`  FAIL  ${e}`)
if (errors.length) {
  console.error(`\ncheck-tokens: ${errors.length} masalah.`)
  process.exit(1)
}
console.log("check-tokens: OK")
