#!/usr/bin/env node
/**
 * Kahade — guard: `retry` HANYA boleh pada GET.
 *
 * Kenapa aturan ini ada (bukan kosmetik):
 *
 *   `lib/api/client.ts` menetapkan
 *       const retry = method === "GET" ? Math.min(2, Math.max(0, options.retry ?? 0)) : 0
 *   Jadi untuk POST/PUT/PATCH/DELETE nilai `retry` dari pemanggil SELALU
 *   dibuang dan digantikan 0. Pada kegagalan pertama `count >= retry`
 *   (0 >= 0) langsung true, sehingga error dilempar apa adanya — mutasi
 *   tidak pernah dicoba ulang.
 *
 *   Itu disengaja dan penting: mutasi keuangan (bayar pesanan, top-up,
 *   withdraw, set PIN) tidak idempoten dari sisi klien. `Idempotency-Key`
 *   dibuat DI DALAM `send()`, artinya tiap percobaan mendapat kunci BARU,
 *   jadi backend tidak punya cara mengenali percobaan ulang sebagai
 *   permintaan yang sama. Menghormati `retry` pada POST berpotensi
 *   menagih dua kali.
 *
 *   Akibatnya `retry: 1` pada mutasi adalah konfigurasi MATI yang berbahaya:
 *   ia tidak melakukan apa pun hari ini, tetapi akan langsung aktif begitu
 *   ada yang "memperbaiki" baris di atas agar menghormati opsinya. Audit
 *   2026-09-08 menemukan 21 situs seperti itu (termasuk
 *   `POST /v1/orders/{id}/pay` dan `/pay-qris`) — semua sudah dibersihkan.
 *   Skrip ini memastikan pola itu tidak kembali.
 *
 * Cara deteksi: setiap kemunculan `http.<method>` membuka satu "wilayah"
 * yang berakhir tepat sebelum `http.` berikutnya. `retry:` di dalam wilayah
 * non-GET adalah pelanggaran. Memakai wilayah (bukan jendela karakter tetap)
 * menghindari salah tuduh pada GET yang kebetulan berdekatan.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const apiDir = join(root, "lib", "api")

/** Kumpulkan semua berkas .ts di bawah lib/api secara rekursif. */
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (name.endsWith(".ts")) out.push(full)
  }
  return out
}

const HEAD = /\bhttp\s*\.\s*(get|post|put|patch|delete)\b/gi
const RETRY = /\bretry\s*:\s*(\d+)/g

const violations = []

for (const file of walk(apiDir)) {
  const src = readFileSync(file, "utf8")
  const heads = []
  for (const m of src.matchAll(HEAD)) {
    heads.push({ at: m.index, method: m[1].toUpperCase() })
  }
  if (heads.length === 0) continue

  for (const m of src.matchAll(RETRY)) {
    // Wilayah = dari head terakhir sebelum `retry` sampai head berikutnya.
    let owner = null
    for (let i = 0; i < heads.length; i += 1) {
      if (heads[i].at > m.index) break
      owner = heads[i]
    }
    if (!owner) continue
    if (owner.method === "GET") continue
    const n = parseInt(m[1], 10)
    if (!Number.isFinite(n) || n === 0) continue // retry: 0 = eksplisit tanpa ulang
    violations.push({
      file: relative(root, file),
      line: src.slice(0, m.index).split("\n").length,
      method: owner.method,
      value: n,
    })
  }
}

if (violations.length > 0) {
  console.error(
    `check:retry GAGAL — ${violations.length} mutasi (non-GET) mendeklarasikan \`retry\`:\n`,
  )
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.method}  retry: ${v.value}`)
  }
  console.error(
    "\n  `retry` pada non-GET diabaikan oleh lib/api/client.ts (dipaksa 0) dan\n" +
      "  Idempotency-Key dibuat ulang tiap percobaan, jadi menghormatinya bisa\n" +
      "  menyebabkan mutasi keuangan terkirim dua kali. Hapus opsinya.\n",
  )
  process.exit(1)
}

console.log("check:retry OK — tidak ada `retry` pada mutasi non-GET")
