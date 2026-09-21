/**
 * D-01/K-04 (audit 2026-09-20): gate dependensi untuk CI nightly.
 *
 * `npm audit` polos tidak bisa dipakai sebagai gate selama masih ada
 * kerentanan yang diketahui & diterima: ia merah permanen dan melatih tim
 * mengabaikan merah. Skrip ini:
 *
 *   1. GAGAL bila ada kerentanan high/critical di luar daftar pengecualian.
 *   2. GAGAL bila ada moderate yang belum dikenal? Tidak — moderate hanya
 *      dilaporkan (tetap harus nol sebelum release, lihat SECURITY-CHECKLIST).
 *   3. Membersihkan diri: pengecualian yang tidak lagi muncul di audit
 *      dilaporkan basi agar daftar tidak berkarat (pola yang sama dengan
 *      KNOWN_DEVIATIONS di scripts/check-api-body.mjs).
 *
 * Setiap pengecualian WAJIB punya alasan + jalur perbaikan; tinjau ulang
 * setiap kenaikan Expo SDK.
 */
import { execFileSync } from "node:child_process"

/**
 * Kerentanan yang SADAR diterima sementara. Kunci = nama paket akar
 * (bukan nenek moyang yang sekadar "depends on vulnerable").
 */
const AUDIT_EXCEPTIONS = new Map([
  [
    "image-size",
    {
      alasan:
        "2 advisory DoS (ICNS/JXL/HEIF parser, GHSA-w3rx-r6r6-pgpr & GHSA-5p2g-fcmc-qvqq). " +
        "Rantai: metro@0.83.3 → image-size@1.2.1 — HANYA build-time, input = aset proyek sendiri " +
        "(trusted), tidak pernah mem-parsing gambar dari pengguna/jaringan. Perbaikan resmi ada di " +
        "image-size >=2.0.3, tetapi v2 menghapus API string-path yang dipakai metro 0.83 — " +
        "override ke v2 MEMATAHKAN `npm run build:web` (diverifikasi 2026-09-21: TypeError di " +
        "detector bmp). Menunggu Expo SDK yang membawa metro kompatibel image-size v2.",
      jalurPerbaikan: "Upgrade Expo SDK (≥55) lalu hapus entri ini.",
      ditinjauTerakhir: "2026-09-21",
    },
  ],
])

let report
try {
  report = JSON.parse(
    execFileSync("npm", ["audit", "--json", "--audit-level=high"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }),
  )
} catch (error) {
  // npm audit exit != 0 saat ada temuan — stdout-nya tetap JSON valid.
  if (error.stdout) report = JSON.parse(error.stdout)
  else throw error
}

const vulns = report.vulnerabilities ?? {}
const blocking = []
const exceptionHit = new Set()

for (const [name, info] of Object.entries(vulns)) {
  if (info.severity !== "high" && info.severity !== "critical") continue
  // Hanya hitung paket yang punya advisory langsung (via = objek); sisanya
  // hanya nenek moyang transitif ("depends on vulnerable versions of …")
  // yang ikut merah karena akar yang sama.
  const hasOwnAdvisory = (info.via ?? []).some((v) => typeof v === "object")
  if (!hasOwnAdvisory) continue
  if (AUDIT_EXCEPTIONS.has(name)) {
    exceptionHit.add(name)
    continue
  }
  blocking.push(`${name} (${info.severity})`)
}

let failed = false
if (blocking.length) {
  console.error("check-audit: GAGAL — kerentanan high/critical baru:")
  for (const b of blocking) console.error(`  - ${b}`)
  console.error("Jalankan `npm audit fix` (non-force) atau tambahkan override; lihat docs/SECURITY-CHECKLIST.md §6.")
  failed = true
}

const stale = [...AUDIT_EXCEPTIONS.keys()].filter((k) => !exceptionHit.has(k))
if (stale.length) {
  console.error("check-audit: pengecualian BASI (sudah tidak muncul di audit) — hapus dari scripts/check-audit.mjs:")
  for (const s of stale) console.error(`  - ${s}`)
  failed = true
}

const counts = report.metadata?.vulnerabilities ?? {}
console.log(
  `check-audit: ${exceptionHit.size} pengecualian aktif, high/critical tak-tercakup ${blocking.length}. ` +
    `(total: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low)`,
)
if (failed) process.exit(1)
console.log("check-audit: OK.")
