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
 *   D. Label gabungan dibangun lewat `summarize()`, bukan `.filter(Boolean).join()`.
 *
 * Ditambah empat aturan anti-regresi (audit #5) untuk pola "a11y kosmetik"
 * yang pernah masuk ke repo secara massal dan lolos review karena terlihat
 * seperti perbaikan:
 *   E. `accessible={false}` tidak boleh menemani semantik a11y — kombinasi itu
 *      mematikan role/label/value/liveRegion pada tag yang sama.
 *   F. `accessibilityHint` generik ("Ketuk untuk berinteraksi") ditolak: tidak
 *      menambah informasi, hanya memperpanjang pengumuman.
 *   G. `hitSlop` literal numerik ditolak — wajib `hitSlopToReach()`/`ICON_*`
 *      dari lib/hit-slop atau `tokens.space[n]` (audit #1).
 *   H. Prop `pointerEvents=` ditolak — deprecated di RN dan react-native-web;
 *      wajib `style.pointerEvents`.
 *   I. Kelas `focus-visible:` tidak boleh ditulis ulang di komponen — wajib
 *      `focusRing`/`focusRingInset` dari lib/focus-ring (audit #6).
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

/**
 * D-12 (audit): berkas `.ts` yang berisi JSX (mis. modul yang mengekspor
 * komponen tanpa mengubah ekstensi) dulu TIDAK pernah dipindai, dan ringkasan
 * akhirnya tidak menyebut batas cakupan itu. Sekarang `.ts` ikut dipindai bila
 * mengandung JSX, dan jumlah berkas yang dilewati dicetak agar cakupannya
 * terlihat (bukan diasumsikan).
 */
const JSX_IN_TS = /<[A-Z][\w.]*[\s/>]|<[a-z]+[\s>][^>]*>/
function walk(dir, out = [], skipped = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      walk(p, out, skipped)
      continue
    }
    if (p.endsWith(".tsx")) {
      out.push(p)
      continue
    }
    if (p.endsWith(".ts")) {
      // Modul non-React (tipe, konstanta, helper) tidak punya aturan a11y —
      // tetapi `.ts` yang benar-benar merender JSX harus ikut diperiksa.
      const src = readFileSync(p, "utf8")
      if (JSX_IN_TS.test(src)) out.push(p)
      else skipped.push(p)
    }
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

const skippedTs = []
const files = [
  ...walk(join(root, "components"), [], skippedTs),
  ...(statSync(join(root, "app")).isDirectory() ? walk(join(root, "app"), [], skippedTs) : []),
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

/**
 * F-02 (audit 2026-09-22): nama komponen LOKAL yang pada akhirnya merender
 * kontrol interaktif — dihitung TRANSITIF per berkas.
 *
 * Gate ini dulu hanya mengenali nama tag dari daftar tetap (Pressable, Button,
 * …). Padahal pola paling umum di repo ini adalah pembungkus lokal
 * (`<Key>`, `<Dot>`, `<FormatChip>`) yang di dalamnya merender
 * `<PressableScale>`. Akibatnya aturan B ("`accessible` menelan kontrol")
 * buta terhadap seluruh pola itu — F-01 adalah bukti nyatanya: `amount-keypad`
 * membungkus 12 `<Key>` dan lolos bertahun-tahun meski menghilangkan 12 tombol
 * dari pembaca layar.
 *
 * Cara kerja: kumpulkan nama komponen lokal (function/const/forwardRef), lalu
 * tandai interaktif bila badannya memuat tag interaktif ATAU komponen lokal
 * lain yang sudah ditandai; ulangi sampai stabil (fixpoint) dengan batas
 * iterasi supaya rekursi tak sengaja tidak membuat gate berputar.
 */
function localInteractiveNames(src) {
  const defs = new Map()
  const defRe = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:function|const|let)\s+([A-Z][A-Za-z0-9_]*)/g
  let m
  const names = []
  while ((m = defRe.exec(src))) {
    const name = m[1]
    names.push(name)
    defs.set(name, m.index)
  }
  const starts = [...defs.values()].sort((a, b) => a - b)
  const bodyOf = (name) => {
    const start = defs.get(name)
    const next = starts.find((i) => i > start) ?? src.length
    return src.slice(start, next)
  }
  const flagged = new Set()
  for (let pass = 0; pass < 6; pass += 1) {
    let grew = false
    for (const name of names) {
      if (flagged.has(name)) continue
      const body = bodyOf(name)
      if (INTERACTIVE_RE.test(body)) {
        flagged.add(name)
        grew = true
        continue
      }
      for (const other of flagged) {
        if (new RegExp(`<${other}\\b`).test(body)) {
          flagged.add(name)
          grew = true
          break
        }
      }
    }
    if (!grew) break
  }
  return flagged
}

/**
 * Badan definisi sebuah komponen lokal (untuk pemeriksaan penjaga).
 * Batasnya adalah definisi BERIKUTNYA — apa pun (termasuk helper huruf kecil),
 * karena `const Cell = profileHeaderStyles` juga menutup badan komponen di
 * atasnya. Bila tidak ada lanjutan, batasnya akhir fungsi terdekat.
 */
function localBodyOf(src, name) {
  const defRe = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:default\\s+)?(?:function|const|let)\\s+${name}\\b`)
  const m = defRe.exec(src)
  if (!m) return ""
  // Mulai dari NAMA komponen (bukan dari `\n` yang ikut tertangkap regex),
  // supaya pencarian "definisi berikutnya" tidak langsung cocok dengan
  // definisi itu sendiri.
  const start = m.index + m[0].indexOf(name)
  const rest = src.slice(start)
  const nextDef = /\n(?:\s*(?:export|default)\s+)?(?:function|const|let)\s+[A-Za-z_$]/.exec(rest)
  return nextDef ? rest.slice(0, nextDef.index) : rest
}

/** Regex interaktif untuk satu berkas: tag bawaan + pembungkus lokal. */
function interactiveReFor(src) {
  const local = [...localInteractiveNames(src)]
  if (!local.length) return INTERACTIVE_RE
  return new RegExp(
    `<((?:${INTERACTIVE.join("|")}|${local.join("|")})\\b|Rating\\b(?![^<>]*\\breadOnly\\b))`,
  )
}


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
  "components/ui/bar-chart.tsx": "Tiap batang sudah <View accessible> berlabel; label kontainer = ringkasan chart (role=image).",
  "components/ui/bottom-sheet.tsx": "Sheet berisi konten interaktif; label dipakai bersama accessibilityViewIsModal + fokus awal (audit #3).",
  "components/ui/incoming-call-prompt.tsx": "Prompt panggilan berisi PressableScale Angkat/Tolak. `accessible` di sini akan menelan kedua kontrol itu (rule B), jadi label kontainer + accessibilityViewIsModal dibiarkan sebagai penanda modal, bukan grup SR.",
  "components/ui/pin-pad.tsx": "Keypad berisi 12 <Key> (PressableScale role=keyboardkey). Label \"Keypad PIN\" adalah penanda area; `accessible` akan menyembunyikan seluruh tombol dari screen reader.",
  "components/ui/loading-screen.tsx": "Layar loading dengan liveRegion; label diumumkan lewat role=progressbar.",
  "components/ui/modal.tsx": "Modal berisi kontrol; label dipakai bersama accessibilityViewIsModal + fokus awal (audit #3).",
  "components/ui/page-indicator.tsx": "Dot dekoratif tanpa label; role=progressbar + accessibilityValue yang dibacakan, bukan grup.",
  "components/ui/progress-bar.tsx": "role=progressbar + accessibilityValue; isinya View fill murni dekoratif.",
  "components/ui/rating.tsx": "Varian interaktif berisi 5 PressableScale bintang; role=adjustable + accessibilityActions.",
  "components/ui/showcase-gallery-grid.tsx": "Grid berisi PressableScale per foto; label hanya untuk state loading.",
  "components/ui/radio.tsx": "Grup radio berisi <Radio> (PressableScale role=radio) — `accessible` akan menelan seluruh opsi; label grup justru dipasang agar pembaca layar mengumumkan konteks pertanyaan (F-08).",
  "components/ui/segmented-control.tsx": "Grup segmen berisi PressableScale role=radio per segmen; `accessible` di container akan menelan semua segmen (F-08).",
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
      // F-02: termasuk pembungkus lokal (<Key>, <Dot>, …) yang merender kontrol.
      const hit = body.match(interactiveReFor(src))
      /*
       * Pengecualian sempit (bukan allowlist berkas): bila `accessible`
       * dikendalikan sebuah IDENTIFIER (`accessible={loading}`) dan komponen
       * lokal yang tertangkap memakai identifier ITU sebagai penjaga sebelum
       * merender kontrolnya (mis. `if (!stat.onPress || loading) return
       * <Skeleton/>`), maka saat `accessible` aktif kontrolnya memang tidak
       * dirender — tidak ada yang tertelan. Kasus nyata: ProfileHeader saat
       * memuat profil.
       */
      const gate = /accessible=\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(tag)?.[1]
      const guardedByGate =
        !!gate &&
        hit &&
        new RegExp(`\\b${gate}\\b`).test(localBodyOf(src, hit[1]))
      if (hit && !guardedByGate) {
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
const NOT_A_CARD = new Set([
  "components/ui/scroll-row.tsx",
  // Baris thread chat = wrapper komposisi (pemisah hari + <ChatMessageBubble>).
  // Elemen yang diumumkan & fokusable adalah bubble-nya sendiri, yang sudah
  // membangun label ringkas (pengirim, isi, jam, status). Label di root baris
  // ini either diabaikan RN (aturan A: tanpa `accessible`) atau menelan chip
  // reaksi + tombol coba lagi di dalam bubble (aturan B) — dua-duanya regresi.
  "components/ui/chat-message-row.tsx",
])

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
// E. `accessible={false}` tidak boleh menemani semantik a11y (audit #5)
// ------------------------------------------------------------------
// `accessible={false}` membuat View BUKAN elemen screen reader. Kalau tag yang
// sama juga membawa `accessibilityRole/Label/Value/State/LiveRegion`, seluruh
// semantik itu mati total: di Android `accessible` -> isFocusable
// (ReactViewManager.kt), di iOS -> isAccessibilityElement
// (RCTViewComponentView.mm:347) dan `accessibilityLabel` hanya menggabungkan
// anak KALAU `isAccessibilityElement` true. Lebih berbahaya lagi bila tag itu
// adalah komponen yang menerima `accessible` dari pemanggil lewat spread
// (`<Card {...rest}>`): nilai `false` dari call site menimpa keputusan
// deliberate di dalam komponen.
const SEMANTIC_A11Y =
  /accessibility(Role|Label|Value|State|LiveRegion|ViewIsModal|ElementsHidden)=/
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /<[A-Za-z][A-Za-z0-9_.]*[\s>/]/g
  let m
  while ((m = re.exec(src))) {
    const tag = readTag(src, m.index)
    if (!/accessible=\{false\}/.test(tag)) continue
    if (!SEMANTIC_A11Y.test(tag)) continue
    fail(
      `${rel}:${lineOf(src, m.index)} \`accessible={false}\` bersama properti semantik a11y — role/label/value/liveRegion pada tag ini TIDAK berefek sama sekali. Hapus \`accessible={false}\`, atau hapus semantiknya (audit #5).`,
    )
  }
}

// ------------------------------------------------------------------
// F. `accessibilityHint` harus informatif (audit #5)
// ------------------------------------------------------------------
// Hint dibacakan screen reader SETELAH label+role. Hint yang hanya mengulang
// affordance generik ("Ketuk untuk berinteraksi") menambah durasi tanpa
// menambah informasi, dan pada elemen non-interaktif (role image/timer/
// progressbar) justru menyesatkan karena tidak ada aksi yang bisa dilakukan.
// Hint yang benar menjelaskan KONSEKUENSI aksi, bukan caranya.
const GENERIC_HINTS = [
  "Ketuk untuk berinteraksi",
  "Ketuk untuk detail",
  "Ketuk untuk melihat detail",
  "Tekan untuk berinteraksi",
  "Tap to interact",
  "Tap for details",
]
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /accessibilityHint="([^"]*)"/g
  let m
  while ((m = re.exec(src))) {
    if (!GENERIC_HINTS.includes(m[1])) continue
    fail(
      `${rel}:${lineOf(src, m.index)} accessibilityHint generik "${m[1]}" — tidak menambah informasi bagi pengguna screen reader. Hapus, atau ganti dengan konsekuensi aksi (audit #5).`,
    )
  }
}

// ------------------------------------------------------------------
// G. `hitSlop` harus berasal dari token/helper, bukan angka literal (audit #1)
// ------------------------------------------------------------------
// lib/hit-slop.ts ada justru supaya call site tidak menghitung slop sendiri.
// Literal seragam (mis. 12 di keempat sisi) menambah 24px per sumbu: pada
// elemen yang SUDAH ≥ 44px itu tidak memperbaiki apa pun, tapi membuat area
// sentuh bertetangga saling menimpa (pin-pad gap-3, rating bintang, tabs
// flex-1, tombol Angkat/Tolak gap-2) sehingga tap bisa jatuh ke kontrol salah.
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /<[A-Za-z][A-Za-z0-9_.]*[\s>/]/g
  let m
  while ((m = re.exec(src))) {
    const tag = readTag(src, m.index)
    const hit = tag.match(/hitSlop=\{\{([^}]*)\}\}/)
    if (!hit) continue
    if (!/:\s*-?\d/.test(hit[1])) continue
    fail(
      `${rel}:${lineOf(src, m.index)} hitSlop literal \`{${hit[1].trim()}}\` — pakai \`hitSlopToReach()\`/\`ICON_SM_HIT_SLOP\` dari lib/hit-slop atau \`tokens.space[n]\`. Angka bebas membuat area sentuh tetangga bertumpuk (audit #1).`,
    )
  }
}

// ------------------------------------------------------------------
// H. Prop `pointerEvents` sudah deprecated — pakai `style.pointerEvents`
// ------------------------------------------------------------------
// React Native menandai prop `pointerEvents` deprecated ("Use
// style.pointerEvents") dan react-native-web hanya mengenali nilai itu lewat
// compiler StyleSheet (dist/exports/StyleSheet/compiler: case 'pointerEvents').
// Prop-nya juga tidak bisa dianimasikan/di-merge dengan style lain.
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /<[A-Za-z][A-Za-z0-9_.]*[\s>/]/g
  let m
  while ((m = re.exec(src))) {
    const tag = readTag(src, m.index)
    if (!/[\s]pointerEvents=/.test(tag)) continue
    fail(
      `${rel}:${lineOf(src, m.index)} prop \`pointerEvents=\` deprecated di React Native & react-native-web — pindahkan ke \`style={{ pointerEvents: ... }}\` (audit #5).`,
    )
  }
}

// ------------------------------------------------------------------
// I. Kelas `focus-visible:` tidak boleh ditulis ulang di komponen (audit #6)
// ------------------------------------------------------------------
// lib/focus-ring.ts adalah satu-satunya sumber indikator fokus keyboard
// (WCAG 2.4.7) dan dokumennya eksplisit: "Jangan tulis ulang string
// `focus-visible:` di komponen". Audit menemukan 56 penulisan ulang yang
// semuanya salah dengan cara yang berbeda-beda, dan semuanya lolos review
// karena SEKILAS terlihat seperti perbaikan aksesibilitas:
//   - warna `ring-primary` + tanpa `ring-offset-background`: celah offset
//     jatuh ke default Tailwind (#fff) sehingga di dark mode muncul halo
//     putih di sekeliling kontrol;
//   - tanpa `outline-none`: outline browser dobel dengan ring;
//   - dipasang pada <View>/<Text> statis yang tidak pernah bisa fokus
//     (`:focus-visible` tidak akan pernah cocok) — CSS mati;
//   - dipasang pada `className` <PressableScale>, yang jatuh ke View di
//     dalam <Animated.View> — juga tidak pernah fokus. Ring harus di
//     `containerClassName` (lihat catatan penempatan di lib/focus-ring.ts).
// Aturan ini memaksa semua indikator fokus lewat konstanta bersama.
const FOCUS_RING_SOURCE = "lib/focus-ring.ts"
for (const abs of files) {
  const rel = relative(root, abs)
  if (rel === FOCUS_RING_SOURCE) continue
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /(?:web:)?focus-visible:[a-z-]+/g
  let m
  while ((m = re.exec(src))) {
    fail(
      `${rel}:${lineOf(src, m.index)} kelas \`${m[0]}\` ditulis manual — impor \`focusRing\`/\`focusRingInset\` dari lib/focus-ring dan pasang di elemen yang BISA fokus (\`containerClassName\` pada PressableScale). Penulisan ulang menghasilkan warna/offset/radius yang beda antar komponen (audit #6).`,
    )
  }
}

// ------------------------------------------------------------------
// J. Tombol yang terkunci karena validasi harus bisa dijelaskan (F-06)
// ------------------------------------------------------------------
// Temuan F-06: tombol simpan bisa `disabled` karena syarat validasi, tetapi
// TIDAK ada pesan apa pun — pengguna pembaca layar menekan tombol yang tidak
// merespons tanpa tahu bagian mana yang belum benar (temuan menyebut
// app/bank-accounts.tsx sebagai contoh).
//
// Ruang lingkupnya SENGAJA sempit: hanya gate validasi yang BERNAMA
// (`disabled={!canSave}`, `disabled={!formValid}`, …). Ekspresi lain
// (`disabled={!onPress}` pada komponen opsional, `disabled={!canPrev}` di tepi
// rentang kalender, `disabled={selectedCount === 0}`) bukan galat validasi
// yang perlu diumumkan — menandainya hanya menghasilkan noise yang membuat
// gate ini diabaikan orang. Gate validasi juga dikenali dari state proses
// (`!submitting`) yang memang sudah punya indikator visual/loading.
const PROCESS_RE =
  /\b(submitting|loading|busy|deleting|saving|updating|refreshing|uploading|processing|sending|pending|inFlight)\b/
const failuresForGate = []
// Nama gate validasi: can*(Proceed|Submit|Save|Continue|Pay|Send|Confirm),
// formValid, isValid, stepValid, canSaveAccount, …
const VALIDATION_GATE_RE =
  /\bdisabled=\{\s*!?\s*(?:can[A-Z][A-Za-z]*|formValid|isValid|stepValid|valid|[A-Za-z]+Valid)\b/
/**
 * Nama gate yang BUKAN validasi isian melainkan BATAS navigasi/rentang
 * (`canPrev`/`canNext` di kalender, `canGoBack` di wizard): tombolnya hidup
 * atau mati karena posisi, bukan karena isian yang kurang — dan labelnya
 * sudah menyebut tujuan tombol, jadi tidak ada pesan yang perlu dicari.
 */
const BOUNDARY_GATE_RE = /^can(Prev|Next|Go|Back|Forward)/
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  const re = /disabled=\{[^}]*\}/g
  let m
  const flagged = []
  while ((m = re.exec(src))) {
    const expr = m[0]
    if (!VALIDATION_GATE_RE.test(expr)) continue
    const gateName = expr.match(/(?:can[A-Z][A-Za-z]*|formValid|isValid|stepValid|valid|[A-Za-z]+Valid)/)?.[0]
    if (gateName && BOUNDARY_GATE_RE.test(gateName)) continue
    const tag = readTag(src, Math.max(0, src.lastIndexOf("<", m.index)))
    if (PROCESS_RE.test(tag)) continue
    flagged.push(lineOf(src, m.index))
  }
  if (!flagged.length) continue
  const hasExplanation =
    /\berrorText=/.test(src) || /\baccessibilityHint=/.test(src) || /\berrorMessage=/.test(src)
  if (hasExplanation) continue
  failuresForGate.push(rel, flagged)
}
for (let i = 0; i < failuresForGate.length; i += 2) {
  const rel = failuresForGate[i]
  const lines = failuresForGate[i + 1]
  fail(
    `${rel}:${lines.join(", ")} tombol \`disabled\` dari gate VALIDASI bernama tetapi berkas ini tidak punya jalur penjelasan ` +
      `(errorText / accessibilityHint) — pengguna screen reader tidak tahu kenapa tombolnya mati. Tampilkan pesan galat ` +
      `(Field/FormSection \`errorText\`) atau \`accessibilityHint\` yang menyebut isian yang kurang (F-06).`,
  )
}

// ------------------------------------------------------------------
// K. Label aksesibilitas bertemplate wajib lewat translate() (F-09)
// ------------------------------------------------------------------
// Temuan F-09: `accessibilityLabel={`Hapus dokumen ${d.name}`}` adalah teks
// yang DIUCAPKAN ke pengguna, tetapi tidak pernah masuk kamus — `localizeChildren`
// hanya menyentuh children <Text>, bukan prop. Akibatnya label ini tetap
// Indonesia di antarmuka Inggris (dan gate E-03 hanya memeriksa <Text>).
// Aturan ini menyamakan perlakuan: literal di luar `${}` yang memuat >= 2 huruf
// berurutan wajib dibungkus `translate("… {x}", { … })`.
const LABEL_TEMPLATE_RE = /accessibilityLabel=\{\s*(`[^`]*`)\s*\}/g
for (const abs of files) {
  const rel = relative(root, abs)
  const src = stripComments(readFileSync(abs, "utf8"))
  let m
  while ((m = LABEL_TEMPLATE_RE.exec(src))) {
    const expr = m[1]
    if (/translate(Prop)?\(/.test(expr)) continue
    // Literal di luar slot runtime (${…}) — slot data murni dilewatkan.
    const literal = expr.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
    if (!/[A-Za-z]{2,}/.test(literal)) continue
    fail(
      `${rel}:${lineOf(src, m.index)} accessibilityLabel bertemplate tidak lewat translate() — label ini diucapkan ke ` +
        `pengguna tetapi tetap berbahasa Indonesia di UI Inggris. Pakai translate("… {x}", { x: … }) (F-09).`,
    )
  }
}

// ------------------------------------------------------------------
// Laporan
// ------------------------------------------------------------------
const tsxCount = files.filter((p) => p.endsWith(".tsx")).length
const tsCount = files.length - tsxCount
console.log(
  `check-a11y: ${files.length} berkas dipindai (${tsxCount} .tsx` +
    (tsCount ? ` + ${tsCount} .ts berisi JSX` : "") +
    `); ${skippedTs.length} .ts non-JSX dilewati (tidak punya aturan a11y)`,
)
for (const w of warnings) console.warn(`  warn  ${w}`)
for (const e of errors) console.error(`  FAIL  ${e}`)
if (errors.length) {
  console.error(`\ncheck-a11y: ${errors.length} masalah.`)
  process.exit(1)
}
console.log("check-a11y: OK")
