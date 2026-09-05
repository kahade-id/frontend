/**
 * Kahade — preflight deep linking web.
 *
 * Jalankan: npm run check:weblinks
 *
 * ── Kenapa skrip ini harus ada ──
 *
 * `expo export --platform web` mengekspor rute dinamis dengan nama harfiah
 * berkurung (`dist/order/[id].html`). Cloudflare Pages menyajikan berkas apa
 * adanya, jadi `/order/123` hanya bekerja kalau ada aturan rewrite di
 * `public/_redirects`.
 *
 * Kegagalannya SENYAP dan tertunda: menambah `app/refund/[id].tsx` tidak
 * memecahkan build, tidak memecahkan tes, dan berjalan sempurna di native.
 * Yang rusak hanya tautan web publik ke rute itu — dan baru ketahuan dari
 * laporan pengguna. Karena itu setiap rute dinamis dicocokkan otomatis di
 * sini terhadap aturan yang benar-benar ada.
 *
 * Hanya memakai modul bawaan Node dan TIDAK butuh `dist/`, supaya bisa
 * berjalan di `npm run check` tanpa build web lebih dulu.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const problems = []
const fail = (m) => problems.push(m)

/* ── 1. Kumpulkan rute dinamis dari app/ ────────────────────────────────── */
const appDir = join(root, "app")
const dynamicRoutes = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    if (!entry.endsWith(".tsx") || entry.startsWith("+") || entry.startsWith("_")) continue

    // Path URL: buang ekstensi, buang segmen grup "(...)", buang "index"
    const rel = relative(appDir, full).replace(/\.tsx$/, "")
    const segments = rel
      .split("/")
      .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
    if (segments[segments.length - 1] === "index") segments.pop()
    const urlPath = "/" + segments.join("/")
    if (urlPath.includes("[")) dynamicRoutes.push(urlPath)
  }
}
walk(appDir)
dynamicRoutes.sort()

/* ── 2. Baca _redirects ─────────────────────────────────────────────────── */
const redirectsPath = join(root, "public/_redirects")
if (!existsSync(redirectsPath)) {
  fail("public/_redirects tidak ada — semua rute dinamis akan 404 di Cloudflare Pages")
} else {
  const rules = readFileSync(redirectsPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/))

  for (const route of dynamicRoutes) {
    // "/order/[id]" -> pola sumber yang diharapkan "/order/:id"
    const expectedFrom = route.replace(/\[([^\]]+)\]/g, ":$1")
    const expectedTo = route + ".html"
    const rule = rules.find((r) => r[0] === expectedFrom)
    if (!rule) {
      fail(
        `rute dinamis ${route} tidak punya aturan di public/_redirects.\n` +
          `         Tambahkan:  ${expectedFrom}  ${expectedTo}  200`,
      )
      continue
    }
    if (rule[1] !== expectedTo) {
      fail(`aturan ${expectedFrom} menunjuk ${rule[1]}, seharusnya ${expectedTo}`)
    }
    if (rule[2] !== "200") {
      fail(`aturan ${expectedFrom} memakai status ${rule[2] ?? "(kosong)"}, seharusnya 200 (rewrite)`)
    }
  }

  // Urutan: rute bersarang harus lebih dulu daripada induknya yang berpola sama.
  const froms = rules.map((r) => r[0])
  for (let i = 0; i < froms.length; i++) {
    for (let j = i + 1; j < froms.length; j++) {
      const a = froms[i].split("/")
      const b = froms[j].split("/")
      // b lebih spesifik (lebih panjang) tetapi berbagi prefix dengan a → salah urut
      if (b.length > a.length && b.slice(0, a.length).every((s, k) => s === a[k] || a[k].startsWith(":"))) {
        fail(`urutan _redirects salah: "${froms[j]}" harus DI ATAS "${froms[i]}" (yang lebih umum menang duluan)`)
      }
    }
  }

  // Catch-all SPA akan menelan /.well-known/*
  const catchAll = rules.find((r) => r[0] === "/*" && r[2] === "200")
  if (catchAll && !froms.some((f) => f.startsWith("/.well-known"))) {
    fail("ada catch-all /* 200 tanpa pengecualian /.well-known/* — berkas verifikasi akan disajikan sebagai HTML")
  }
}

/* ── 3. Berkas verifikasi ───────────────────────────────────────────────── */
const assetlinksPath = join(root, "public/.well-known/assetlinks.json")
if (!existsSync(assetlinksPath)) {
  fail("public/.well-known/assetlinks.json tidak ada — App Links Android tidak bisa diverifikasi")
} else {
  const al = JSON.parse(readFileSync(assetlinksPath, "utf8"))
  const target = al[0]?.target
  const appPkg = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo.android?.package
  if (target?.package_name !== appPkg) {
    fail(`assetlinks.json package_name "${target?.package_name}" != app.json android.package "${appPkg}"`)
  }
  if (!Array.isArray(target?.sha256_cert_fingerprints)) {
    fail("assetlinks.json: sha256_cert_fingerprints harus berupa array")
  }
}

const aasaPath = join(root, "public/.well-known/apple-app-site-association")
if (!existsSync(aasaPath)) {
  fail("public/.well-known/apple-app-site-association tidak ada — Universal Links iOS tidak akan bekerja")
} else {
  const raw = readFileSync(aasaPath, "utf8")
  let aasa
  try {
    aasa = JSON.parse(raw)
  } catch {
    fail("apple-app-site-association bukan JSON valid — iOS menolaknya tanpa pesan error")
  }
  if (aasa) {
    const details = aasa.applinks?.details ?? []
    if (details.length === 0) fail("apple-app-site-association: applinks.details kosong")
    const bundleId = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo.ios?.bundleIdentifier
    for (const d of details) {
      if (!String(d.appID ?? "").endsWith(`.${bundleId}`)) {
        fail(`apple-app-site-association: appID "${d.appID}" tidak berakhir dengan bundleIdentifier ".${bundleId}"`)
      }
    }
  }
}

/* ── 4. _headers menetapkan Content-Type AASA ───────────────────────────── */
const headersPath = join(root, "public/_headers")
if (!existsSync(headersPath)) {
  fail("public/_headers tidak ada — AASA akan disajikan sebagai application/octet-stream dan iOS menolaknya")
} else {
  const h = readFileSync(headersPath, "utf8")
  const block = h.split(/\n(?=\S)/).find((b) => b.startsWith("/.well-known/apple-app-site-association"))
  if (!block) {
    fail("_headers tidak punya blok untuk /.well-known/apple-app-site-association")
  } else if (!/Content-Type:\s*application\/json/i.test(block)) {
    fail("_headers: apple-app-site-association harus di-set Content-Type: application/json")
  }
}

/* ── 5. app.json: App Links & Universal Links ───────────────────────────── */
const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo
if (!app.scheme) fail("app.json: scheme kosong — deep link kahade:// tidak akan bekerja")

const filters = app.android?.intentFilters ?? []
const verified = filters.find((f) => f.autoVerify === true && f.action === "VIEW")
if (!verified) {
  fail("app.json: tidak ada intentFilter VIEW dengan autoVerify:true — App Links Android tidak akan terverifikasi")
} else {
  const cats = verified.category ?? []
  for (const need of ["BROWSABLE", "DEFAULT"]) {
    if (!cats.includes(need)) fail(`app.json: intentFilter kekurangan category ${need}`)
  }
  const hosts = (verified.data ?? []).map((d) => d.host)
  const domains = (app.ios?.associatedDomains ?? []).map((d) => d.replace(/^applinks:/, ""))
  for (const host of hosts) {
    if (!domains.includes(host)) {
      fail(`host Android "${host}" tidak punya pasangan applinks:${host} di ios.associatedDomains`)
    }
  }
  for (const d of domains) {
    if (!hosts.includes(d)) fail(`applinks:${d} tidak punya pasangan host di android.intentFilters`)
  }
}

/* ── Hasil ──────────────────────────────────────────────────────────────── */
if (problems.length === 0) {
  console.log(
    `check-weblinks: OK — ${dynamicRoutes.length} rute dinamis punya rewrite, berkas verifikasi & app.json konsisten`,
  )
  process.exit(0)
}
for (const p of problems) console.error(`  GAGAL  ${p}`)
console.error(`\ncheck-weblinks: ${problems.length} masalah. Lihat docs/DEEP-LINKING.md.`)
process.exit(1)
