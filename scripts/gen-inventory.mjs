#!/usr/bin/env node
/**
 * Kahade — generator inventaris route (`npm run gen:inventory`).
 *
 * Menghasilkan:
 *   - docs/audit/inventory.json  → dipakai tests/e2e/regression.spec.ts untuk
 *     memastikan SETIAP route publik dirender aman tanpa sesi (deep link audit).
 *   - docs/audit/ROUTES.md       → daftar halaman manusia-baca untuk review.
 *
 * ── Kenapa skrip ini ada ──
 * Sebelumnya inventory.json dihasilkan `scripts/audit-inventory.mjs` bersama
 * audit kontrak API, sehingga keduanya butuh `docs/api/kahade-api-mobile.json`
 * (OpenAPI dari repo backend). Itu membuat typecheck + test:e2e GAGAL total
 * hanya karena berkas spec backend tidak ikut tersimpan di repo frontend:
 * satu artefak hilang mematikan tiga pemeriksaan yang tidak ada hubungannya
 * dengan API. Inventaris route 100% bisa diturunkan dari `app/` — sama
 * persis seperti cara Expo Router menyelesaikannya — jadi sekarang
 * dipisah ke skrip ini yang TIDAK butuh spec backend.
 *
 * Penurunan path mengikuti aturan Expo Router:
 *   - ekstensi .tsx dibuang; `+html.tsx`/`+not-found.tsx`/`_layout.tsx` bukan route halaman
 *   - segmen grup `(auth)` tidak muncul di URL
 *   - `index` → `/`
 *   - `[id]` adalah route dinamis (ditandai `dynamic: true`)
 *
 * Hanya memakai modul bawaan Node.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const appDir = join(root, "app")
const outDir = join(root, "docs", "audit")

const routes = []

function walk(dir, prefix = "") {
  const entries = readdirSync(dir).sort()
  for (const entry of entries) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Grup (auth)/(tabs) tidak masuk URL.
      const segment = /^\(.*\)$/.test(entry) ? "" : `${entry}/`
      walk(full, prefix + segment)
      continue
    }
    if (!entry.endsWith(".tsx")) continue
    const stem = entry.replace(/\.tsx$/, "")
    if (stem.startsWith("+")) continue // +html, +not-found, +redux, dll.
    const urlPath =
      stem === "index" ? `/${prefix}` : `/${prefix}${stem}`.replace(/\/+$/, "")
    const file = relative(root, full).split("\\").join("/")
    routes.push({
      file,
      route: stem === "index" && urlPath === "" ? "/" : urlPath,
      dynamic: /\[[^\]]+\]/.test(urlPath),
    })
  }
}

if (!existsSync(appDir)) {
  console.error("gen-inventory: direktori app/ tidak ditemukan.")
  process.exit(1)
}
walk(appDir)
routes.sort((a, b) => a.route.localeCompare(b.route))

// `/index` di root sudah jadi `/` lewat aturan di atas; rapikan slash ganda.
for (const entry of routes) entry.route = entry.route.replace(/\/{2,}/g, "/")

const inventory = {
  /** Dihasilkan skrip; JANGAN edit manual. Jalankan `npm run gen:inventory`. */
  generator: "scripts/gen-inventory.mjs",
  routeCount: routes.length,
  dynamicRouteCount: routes.filter((r) => r.dynamic).length,
  routes,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "inventory.json"), JSON.stringify(inventory, null, 2) + "\n")

const lines = [
  "# Inventaris halaman (dihasilkan `npm run gen:inventory`; jangan edit manual)",
  "",
  `${routes.length} route halaman, ${inventory.dynamicRouteCount} di antaranya dinamis.`,
  "",
  "| Route | Berkas | Dinamis |",
  "| --- | --- | --- |",
  ...routes.map((r) => `| \`${r.route}\` | \`${r.file}\` | ${r.dynamic ? "ya" : ""} |`),
  "",
]
writeFileSync(join(outDir, "ROUTES.md"), lines.join("\n"))

console.log(`gen-inventory: ${routes.length} route → docs/audit/inventory.json, docs/audit/ROUTES.md`)
if (process.argv.includes("--check")) {
  const expected = JSON.stringify(inventory, null, 2) + "\n"
  const current = existsSync(join(outDir, "inventory.json"))
    ? readFileSync(join(outDir, "inventory.json"), "utf8")
    : ""
  if (current !== expected) {
    console.error("gen-inventory: inventory.json basi — jalankan `npm run gen:inventory`.")
    process.exit(1)
  }
  console.log("gen-inventory: OK")
}
