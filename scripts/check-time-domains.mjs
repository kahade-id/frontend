#!/usr/bin/env node
/**
 * check-time-domains — gate domain waktu (hasil audit E-03, 2026-09-22).
 *
 * Kenapa gate ini ada (non-obvious): repo punya TIGA domain waktu — jam
 * perangkat (`Date.now()`), jam server (`serverNow()`), dan timestamp ISO dari
 * respons API. Bug yang sudah TERJADI dua kali (A-02, E-01, E-03) semuanya
 * berbentuk sama: nilai dari satu domain dibandingkan dengan "sekarang" dari
 * domain lain. Gejalanya tidak muncul di perangkat pengembang (jam akurat),
 * hanya di perangkat yang jamnya meleset beberapa menit — persis kasus yang
 * paling sulit direproduksi. Dokumen lengkapnya: docs/waktu.md.
 *
 * Tiga aturan:
 *   1. Modul ber-domain server tidak boleh memakai `Date.now()` untuk "sekarang"
 *      (kecuali barisnya bertanda `waktu-perangkat:` + alasan).
 *   2. Pola `*until = Date.now()` / `*deadline = Date.now()` dilarang di mana pun
 *      — timestamp itu dibaca komponen waktu ber-`serverNow()`, jadi cooldown
 *      bisa kolaps ke nol (E-01) atau terkunci jauh lebih lama dari seharusnya.
 *   3. `until={Date.now()…}` yang diteruskan ke komponen countdown dilarang.
 *
 * False positive ditangani dengan penanda eksplisit, bukan dengan melebarkan
 * pengecualian: allowlist `SERVER_DOMAIN_MODULES` punya alasan, dan bila salah
 * satu modul tidak lagi memakai `Date.now()` sama sekali gate tetap lolos
 * (tidak ada entri basi untuk dibersihkan). Penanda `waktu-perangkat:` boleh
 * ditulis di baris yang sama ATAU di baris komentar tepat di atasnya — alasan
 * biasanya butuh lebih dari satu baris (lihat `lib/ui-prefs.ts`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rel = (p) => relative(root, p)

/** Modul yang "sekarang"-nya WAJIB `serverNow()` — beserta alasannya. */
const SERVER_DOMAIN_MODULES = {
  "lib/ui-prefs.ts":
    "menyimpan `ratingSnoozeUntil` di domain server; membaca dengan jam perangkat memangkas/memanjangkan penundaan 3 hari (E-03).",
  "lib/pending-actions.ts":
    "`expiresAt` aksi menggantung datang dari respons server; dibandingkan `serverNow()` (A-02).",
  "components/pending-actions-banner.tsx":
    "menyaring `expiresAt` aksi menggantung (domain server) saat render (E-03).",
  "components/ui/countdown.tsx":
    "seluruh aritmetika sisa waktu memakai `serverNow()`; `Date.now()` di sini membatalkan koreksi offset (E-01).",
}

const DEVICE_MARKER = "waktu-perangkat:"

const failures = []
const notes = []

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      yield* walk(p)
    } else if (/\.tsx?$/.test(p)) {
      yield p
    }
  }
}

const files = [...walk(join(root, "app")), ...walk(join(root, "components")), ...walk(join(root, "lib"))]

/**
 * Apakah baris ini (atau komentar tepat di atasnya) bertanda `waktu-perangkat:`.
 * Penanda di blok komentar multi-baris dianggap berlaku untuk baris pertama
 * setelah blok itu berakhir — pola yang dipakai `lib/ui-prefs.ts`.
 */
function hasDeviceMarker(lines, index) {
  const line = lines[index]
  if (line.includes(DEVICE_MARKER)) return true
  for (let i = index - 1; i >= 0; i -= 1) {
    const prev = lines[i]
    if (/^\s*\/\//.test(prev)) {
      if (prev.includes(DEVICE_MARKER)) return true
      continue
    }
    if (/^\s*\*/.test(prev)) {
      if (prev.includes(DEVICE_MARKER)) return true
      continue
    }
    break
  }
  return false
}

/** Buang komentar blok agar contoh di docblock tidak dianggap kode. */
function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
}

// ------------------------------------------------------------------
// 1. Modul ber-domain server
// ------------------------------------------------------------------
for (const [file, reason] of Object.entries(SERVER_DOMAIN_MODULES)) {
  let src
  try {
    src = stripBlockComments(readFileSync(join(root, file), "utf8"))
  } catch {
    failures.push(`1 ${file} tidak ditemukan — perbarui SERVER_DOMAIN_MODULES di scripts/check-time-domains.mjs`)
    continue
  }
  const lines = src.split("\n")
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.includes("Date.now()")) continue
    const isComment = /^\s*(\*|\/\/)/.test(line)
    if (isComment || hasDeviceMarker(lines, i)) continue
    failures.push(
      `1 ${file}:${i + 1} memakai Date.now() di modul ber-domain server — pakai serverNow() (${reason}) ` +
        `atau tandai barisnya dengan komentar \`${DEVICE_MARKER} <alasan>\` bila memang jam perangkat.`,
    )
  }
}

// ------------------------------------------------------------------
// 2 & 3. Pola timestamp tenggat dari jam perangkat
// ------------------------------------------------------------------
const UNTIL_ASSIGN = /([A-Za-z_$][\w$]*(?:until|Until|deadline|Deadline|expires|Expires|expiry|Expiry|cooldown|Cooldown)[\w$]*)\s*[:=]\s*Date\.now\(\)/
const UNTIL_PROP = /\buntil=\{\s*(?:new Date\(\s*)?Date\.now\(\)/

for (const path of files) {
  const src = stripBlockComments(readFileSync(path, "utf8"))
  const lines = src.split("\n")
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*(\*|\/\/)/.test(line) || hasDeviceMarker(lines, i)) continue
    if (UNTIL_ASSIGN.test(line)) {
      failures.push(
        `2 ${rel(path)}:${i + 1} timestamp tenggat/cooldown dibuat dari Date.now() — komponen waktu membandingkannya ` +
          `dengan serverNow(), jadi cooldown bisa langsung nol atau terkunci kelamaan (E-01). Pakai serverNow()` +
          ` (docs/waktu.md).`,
      )
    }
    if (UNTIL_PROP.test(line)) {
      failures.push(
        `3 ${rel(path)}:${i + 1} until={Date.now()…} diteruskan langsung ke komponen countdown — nilai jam perangkat ` +
          `dibandingkan dengan serverNow() di dalamnya. Pakai serverNow() (docs/waktu.md).`,
      )
    }
  }
}

// ------------------------------------------------------------------
// Laporan
// ------------------------------------------------------------------
if (failures.length) {
  console.error(`\ncheck-time-domains gagal (${failures.length} masalah):`)
  for (const f of failures) console.error(`  ${f}`)
  console.error("\nAturan domain waktu: docs/waktu.md\n")
  process.exit(1)
}

notes.push(`${Object.keys(SERVER_DOMAIN_MODULES).length} modul ber-domain server, ${files.length} berkas dipindai`)
console.log(`check-time-domains: OK — ${notes.join("; ")}.`)
