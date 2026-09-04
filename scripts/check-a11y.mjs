#!/usr/bin/env node
/**
 * audit(#4) — Grouping & urutan baca kartu.
 *
 * Akar masalah yang ditemukan audit #4 bukan "kartu lupa diberi label",
 * melainkan label yang **ditulis tapi diam-diam tidak berefek**:
 *
 *   1. `<View accessibilityLabel="...">` TANPA `accessible` — React Native
 *      mengabaikan label itu sepenuhnya. Screen reader tetap membaca setiap
 *      <Text> di dalamnya sebagai elemen terpisah (5–8 fragmen per kartu).
 *      Ini juga bug lama di `<Card>`: prop `accessibilityLabel` diterima
 *      tapi tidak pernah diteruskan ke <View> pada varian statis.
 *
 *   2. Kebalikannya: `accessible` di root yang MENELAN kontrol di dalamnya.
 *      `accessible` membuat seluruh subtree berhenti jadi target fokus, jadi
 *      Button/Switch/IconButton di dalam kartu hilang dari screen reader.
 *      Ini regresi yang jauh lebih berbahaya daripada label hilang.
 *
 * Skrip ini menjaga keduanya:
 *   A. Setiap elemen dengan `accessibilityLabel` (selain komponen yang
 *      memang menerimanya sebagai prop) harus punya `accessible`, atau
 *      `accessibilityRole` yang implisit fokusable.
 *   B. Elemen `accessible` tidak boleh membungkus komponen interaktif.
 *   C. Kartu/list-item/row punya jalur label ringkas (root berlabel,
 *      <CardSummary>, atau meneruskan accessibilityLabel ke primitif).
 *
 * Jalankan: pnpm check:a11y
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const errors = []
const warnings = []
const fail = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)

// ------------------------------------------------------------------
// Util
// ------------------------------------------------------------------

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith(".tsx")) out.push(p)
  }
  return out
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length

/**
 * Ganti isi komentar dengan spasi (panjang & baris dipertahankan agar offset
 * dan nomor baris tetap akurat). Tanpa ini, contoh kode `<CardSummary>` di
 * komentar dokumentasi ikut terbaca sebagai tag sungguhan.
 */
function stripComments(src) {
  let out = ""
  let i = 0
  const blank = (t) => t.replace(/[^\n]/g, " ")
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === "//") {
      const end = src.indexOf("\n", i)
      const stop = end === -1 ? src.length : end
      out += blank(src.slice(i, stop))
      i = stop
    } else if (two === "/*") {
      const end = src.indexOf("*/", i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += blank(src.slice(i, stop))
      i = stop
    } else {
      out += src[i]
      i++
    }
  }
  return out
}

/** Ambil teks tag pembuka mulai dari `<Name`, sadar kurung kurawal & string. */
function readTag(src, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") quote = c
    else if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === ">" && depth === 0) return src.slice(start, i + 1)
  }
  return src.slice(start)
}

/**
 * Isi elemen `<Name ...>` sampai `</Name>` yang cocok (nesting-aware).
 * Tag self-closing (`<View ... />`) tidak menambah kedalaman.
 */
function readChildren(src, tagEnd, name) {
  let depth = 1
  let i = tagEnd
  const open = new RegExp(`<${name}\\b`, "g")
  const close = new RegExp(`</${name}>`, "g")
  while (i < src.length) {
    open.lastIndex = i
    close.lastIndex = i
    const o = open.exec(src)
    const c = close.exec(src)
    if (!c) return src.slice(tagEnd)
    if (o && o.index < c.index) {
      const t = readTag(src, o.index)
      if (!t.trimEnd().endsWith("/>")) depth++
      i = o.index + t.length
      continue
    }
    depth--
    if (depth === 0) return src.slice(tagEnd, c.index)
    i = c.index + name.length + 3
  }
  return src.slice(tagEnd)
}

const files = [
  ...walk(join(root, "components")),
  ...(statSync(join(root, "app")).isDirectory() ? walk(join(root, "app")) : []),
]

// ------------------------------------------------------------------
// A. accessibilityLabel pada View harus dibarengi `accessible`
// ------------------------------------------------------------------

// Komponen yang HARUS tetap jadi target fokus tersendiri.
// Role yang membuat elemen fokusable/announce sendiri tanpa `accessible`.
const SELF_ANNOUNCING =
  /accessibilityRole="(button|link|imagebutton|adjustable|switch|checkbox|radio|tab|menuitem|search|togglebutton)"/

const INTERACTIVE = [
  "Button",
  "IconButton",
  "TextLink",
  "Switch",
  "Checkbox",
  "Radio",
  "Pressable",
  "PressableScale",
  "TouchableOpacity",
  "TextInput",
  "Input",
  "Slider",
  "CopyableField",
  "ReadMore",
]
// `<Rating readOnly>` hanya tampilan (tidak ada PressableScale bintang), jadi
// aman berada di dalam grup; yang interaktif punya onChange tanpa readOnly.
const INTERACTIVE_RE = new RegExp(
  `<((?:${INTERACTIVE.join("|")})\\b|Rating\\b(?![^<>]*\\breadOnly\\b))`,
)


// Hanya <View>: komponen lain (Card, Button, Icon, Badge, ...) menerima
// accessibilityLabel sebagai prop dan meneruskannya sendiri.
//
// Dua kasus berbeda, dan hanya satu yang bisa diperbaiki dengan `accessible`:
//
//   - Daun (tidak ada anak fokusable): label TANPA `accessible` hilang total
//     -> FAIL, perbaikannya tambahkan `accessible`.
//   - Kontainer yang isinya sudah fokusable sendiri (tombol keypad, bintang
//     rating, batang chart berlabel): `accessible` justru akan MENELAN
//     anak-anak itu. Labelnya memang tidak dibacakan sebagai satu grup —
//     itu konsekuensi yang diterima, karena role kontainer (adjustable /
//     progressbar / timer) tetap memberi konteks. Kasus ini harus terdaftar
//     di CONTAINER_LABEL_ALLOWLIST beserta alasannya.

const CONTAINER_LABEL_ALLOWLIST = {
  "components/ui/avatar.tsx": "Badge verified di dalamnya berlabel sendiri; role=image + label cukup sebagai fallback.",
  "components/ui/bar-chart.tsx": "Tiap batang sudah <View accessible> berlabel; label kontainer = ringkasan chart (role=image).",
  "components/ui/bottom-sheet.tsx": "Sheet berisi konten interaktif; label dipakai bersama accessibilityViewIsModal + fokus awal (audit #3).",
  "components/ui/countdown.tsx": "Live region: label diperbarui tiap detik; isinya <Text> murni, tapi `accessible` mematikan pembaruan liveRegion di Android.",
  "components/ui/incoming-call-prompt.tsx": "Overlay panggilan berisi tombol Terima/Tolak yang wajib fokusable (audit #3).",
  "components/ui/loading-screen.tsx": "Layar loading dengan liveRegion; label diumumkan lewat role=progressbar.",
  "components/ui/logo.tsx": "Lockup = mark + wordmark, keduanya SVG dekoratif; role=image sudah cukup untuk iOS.",
  "components/ui/modal.tsx": "Modal berisi kontrol; label dipakai bersama accessibilityViewIsModal + fokus awal (audit #3).",
  "components/ui/page-indicator.tsx": "Dot dekoratif tanpa label; role=progressbar + accessibilityValue yang dibacakan, bukan grup.",
  "components/ui/pin-input.tsx": "Kotak digit dekoratif; role=progressbar + accessibilityValue yang dibacakan.",
  "components/ui/pin-pad.tsx": "Berisi 12 tombol keypad yang wajib fokusable satu per satu.",
  "components/ui/progress-bar.tsx": "role=progressbar + accessibilityValue; isinya View fill murni dekoratif.",
  "components/ui/progress-ring.tsx": "role=progressbar + accessibilityValue; children bisa berisi <Text> nilai.",
  "components/ui/rating.tsx": "Varian interaktif berisi 5 PressableScale bintang; role=adjustable + accessibilityActions.",
  "components/ui/showcase-gallery-grid.tsx": "Grid berisi PressableScale per foto; label hanya untuk state loading.",
}

const containerSeen = new Set()

for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /<View\b/g
  let m
  while ((m = re.exec(src))) {
    const tag = readTag(src, m.index)
    if (!/accessibilityLabel/.test(tag)) continue
    if (/\baccessible\b/.test(tag)) continue
    if (SELF_ANNOUNCING.test(tag)) continue

    // Anak fokusable tidak selalu terdeteksi dari nama tag (banyak yang
    // dibungkus komponen lokal seperti <Key>/<Dot>), jadi keputusan
    // "kontainer atau daun" diambil dari allowlist yang ditulis manusia.
    if (rel in CONTAINER_LABEL_ALLOWLIST) {
      containerSeen.add(rel)
      continue
    }

    fail(
      `${rel}:${lineOf(src, m.index)} <View accessibilityLabel> tanpa \`accessible\` — RN mengabaikan label ini sehingga isinya dibaca per fragmen. Tambahkan \`accessible\`; kalau grup ini berisi elemen fokusable, JANGAN — daftarkan di CONTAINER_LABEL_ALLOWLIST + alasannya (audit #4).`,
    )
  }
}
for (const rel of Object.keys(CONTAINER_LABEL_ALLOWLIST)) {
  if (!containerSeen.has(rel)) {
    warn(`CONTAINER_LABEL_ALLOWLIST: ${rel} tidak lagi punya label kontainer — hapus entrinya`)
  }
}

// ------------------------------------------------------------------
// B. `accessible` tidak boleh menelan kontrol interaktif
// ------------------------------------------------------------------
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  for (const name of ["View", "CardSummary"]) {
    const re = new RegExp(`<${name}\\b`, "g")
    let m
    while ((m = re.exec(src))) {
      const tag = readTag(src, m.index)
      const isGroup = name === "CardSummary" || /\baccessible\b(?!=\{false\})/.test(tag)
      if (!isGroup) continue
      if (tag.trimEnd().endsWith("/>")) continue
      const body = readChildren(src, m.index + tag.length, name)
      const hit = body.match(INTERACTIVE_RE)
      if (hit) {
        fail(
          `${rel}:${lineOf(src, m.index)} <${name} accessible> membungkus <${hit[1]}> — \`accessible\` menelan seluruh subtree sehingga kontrol itu HILANG dari screen reader. Pindahkan kontrol keluar grup (audit #4).`,
        )
      }
    }
  }
}

// ------------------------------------------------------------------
// C. Kartu & list item punya jalur label ringkas
// ------------------------------------------------------------------
const CARD_FILE = /-(card|item|row)\.tsx$/

// Nama file berakhiran -row/-item tapi BUKAN kartu: primitif layout murni
// yang tidak punya konten teks sendiri. Glob di BACKLOG.md terlalu lebar.
const NOT_A_CARD = new Set(["components/ui/scroll-row.tsx"])

for (const abs of files) {
  const rel = relative(root, abs)
  if (!CARD_FILE.test(rel) || NOT_A_CARD.has(rel)) continue
  const src = stripComments(readFileSync(abs, "utf8"))
  const hasSummary =
    /accessibilityLabel/.test(src) || /<CardSummary\b/.test(src) || /\bsummarize\(/.test(src)
  if (!hasSummary) {
    fail(
      `${rel} kartu/list item tanpa jalur label ringkas — screen reader akan membacanya sebagai fragmen lepas. Beri accessibilityLabel di root (kartu statis), atau <CardSummary> bila ada kontrol di dalamnya (audit #4).`,
    )
  }
}

// ------------------------------------------------------------------
// D. Helper summarize() dipakai, bukan .filter(Boolean).join(", ") manual
// ------------------------------------------------------------------
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /accessibilityLabel[\s\S]{0,400}?\.filter\(Boolean\)\s*\n?\s*\.?join\(", "\)/g
  let m
  while ((m = re.exec(src))) {
    warn(
      `${rel}:${lineOf(src, m.index)} rangkaian label manual \`.filter(Boolean).join(", ")\` — pakai \`summarize()\` dari lib/a11y (audit #4).`,
    )
  }
}

// ------------------------------------------------------------------
// Laporan
// ------------------------------------------------------------------
console.log(`check-a11y: ${files.length} file .tsx dipindai`)
for (const w of warnings) console.warn(`  warn  ${w}`)
for (const e of errors) console.error(`  FAIL  ${e}`)
if (errors.length) {
  console.error(`\ncheck-a11y: ${errors.length} masalah.`)
  process.exit(1)
}
console.log("check-a11y: OK")
