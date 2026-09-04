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
 *  8. (audit #9) app.json: splash backgroundColor == light.background dan
 *     expo-notifications color == light.primary — konfigurasi native tidak
 *     bisa import tokens.ts, jadi literalnya diverifikasi di sini.
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
  if (splash.dark?.backgroundColor && !eqColor(splash.dark.backgroundColor, dark.background)) {
    fail(`app.json: splash dark.backgroundColor ${splash.dark.backgroundColor} != tokens.colors.dark.background ${dark.background}`)
  }
}
const notif = pluginOpts("expo-notifications")
if (notif?.color && !eqColor(notif.color, light.primary)) {
  fail(`app.json: expo-notifications color ${notif.color} != tokens.colors.light.primary ${light.primary}`)
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
