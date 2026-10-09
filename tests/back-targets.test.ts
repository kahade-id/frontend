/**
 * Temuan #17 — audit tombol kembali: setiap rute harus punya induk yang NYATA.
 *
 * Dua kegagalan yang paling sering dikeluhkan:
 *
 * 1. **Self-loop** — `logicalParentForPath(p)` mengembalikan `p` sendiri.
 *    Tombol kembali header lalu menjadi no-op (dipencet, tidak ke mana-mana).
 *    Ini persis bug B3P-01 yang dulu menimpa `/questions`.
 *
 * 2. **Induk mengarah ke rute yang tidak ada** — salah ketik, atau rute sudah
 *    dihapus (mis. `/settings` yang dihapus 2026-10-05) tapi peta belum
 *    diperbarui. Gejalanya: `router.replace` ke halaman 404/`+not-found`,
 *    yang dari kacamata pengguna = "kembali tapi nyasar".
 *
 * Test ini menurunkan daftar rute LANGSUNG dari berkas di `app/` (satu-satunya
 * sumber kebenaran), memanggil `logicalParentForPath` untuk tiap rute, lalu
 * memastikan hasilnya terdaftar dan bukan dirinya sendiri.
 */
import { readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { backTargetForPath, logicalParentForPath } from "@/lib/notification-routing"

const APP_DIR = resolve(process.cwd(), "app")

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Rute terdaftar: path URL yang benar-benar punya berkas. */
function registeredRoutes(): string[] {
  return walk(APP_DIR)
    .map((file) => relative(APP_DIR, file).replace(/\.tsx?$/, "").replace(/\\/g, "/"))
    .map((route) => route.replace(/\/index$/, ""))
    .filter((route) => !route.startsWith("_layout") && !route.startsWith("+"))
}

/** `/user/[username]/ratings` → `["user", "ratings"]` (segmen dinamis & grup dibuang). */
function staticSegments(route: string): string[] {
  return route
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^\([^/]+\)$/.test(segment) && !/^\[[^/]+\]$/.test(segment))
}

/** Rute uji: path konkret untuk tiap rute (segmen dinamis jadi `contoh`). */
function samplePath(route: string): string {
  const segments = route
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^\([^/]+\)$/.test(segment))
    .map((segment) => (/^\[[^/]+\]$/.test(segment) ? "contoh" : segment))
  return `/${segments.join("/")}`
}

function parentPathOf(pathname: string): string | null {
  const href = logicalParentForPath(pathname)
  if (typeof href === "string") return href.split(/[?#]/, 1)[0] ?? null
  if (href && typeof href === "object" && "pathname" in href) {
    const value = (href as { pathname?: string }).pathname
    return value ? value.split(/[?#]/, 1)[0] ?? null : null
  }
  return null
}

/** Apakah `candidate` cocok dengan salah satu rute terdaftar (dengan segmen dinamis). */
function matchesRegistered(candidate: string, registered: string[]): boolean {
  const target = candidate.replace(/\/+$/, "") || "/"
  return registered.some((route) => {
    const segments = route.split("/").filter(Boolean)
    const candidateSegments = target.split("/").filter(Boolean)
    if (segments.length !== candidateSegments.length) return false
    return segments.every(
      (segment, i) => /^\[[^/]+\]$/.test(segment) || segment === candidateSegments[i],
    )
  })
}

const registered = registeredRoutes()

describe("rute terdaftar terbaca", () => {
  it("audit menemukan rute (penjaga agar test ini tidak kosong)", () => {
    expect(registered.length).toBeGreaterThan(40)
    expect(registered).toContain("chat/[roomId]")
  })
})

describe("backTargetForPath — induk yang DIJAMIN bukan diri sendiri", () => {
  const paths = [...new Set(registered.filter((r) => staticSegments(r).length > 0).map(samplePath))]

  it("tidak pernah mengembalikan path itu sendiri (back tidak pernah no-op)", () => {
    const loops = paths.filter((path) => backTargetForPath(path) === path)
    expect(loops).toEqual([])
  })

  it("layar hub (induknya diri sendiri) dilaporkan null, bukan self-loop", () => {
    // `/faq`, `/wallet`, `/disputes`, `/chat`, … dipetakan per SEGMEN
    // PERTAMA, sehingga `logicalParentForPath("/faq") === "/faq"`.
    // `backTargetForPath` harus mengubahnya jadi null supaya pemanggil
    // memilih sendiri (sembunyikan tombol / ke beranda).
    expect(backTargetForPath("/faq")).toBeNull()
    expect(backTargetForPath("/wallet")).toBeNull()
    expect(backTargetForPath("/chat")).toBeNull()
    expect(backTargetForPath("/showcase")).toBeNull()
    // Dan layar yang punya induk tetap bekerja seperti sebelumnya.
    expect(backTargetForPath("/chat/room-1")).toBe("/chat")
    expect(backTargetForPath("/order/abc")).toBe("/transactions")
    expect(backTargetForPath("/invoice/abc")).toBe("/transactions")
    // Story dibuka dari tray di tab Pesan → kembali ke /chat.
    expect(backTargetForPath("/story/contoh")).toBe("/chat")
  })

  it("setiap induk non-null adalah rute yang terdaftar", () => {
    const orphans = paths
      .map((path) => ({ path, parent: backTargetForPath(path) }))
      .filter((entry) => entry.parent !== null && !matchesRegistered(entry.parent, registered))
    expect(orphans).toEqual([])
  })
})

describe("logicalParentForPath — induk tombol kembali", () => {
  // Rute yang MEMANG layar pra-sesi/terminal: induknya boleh di luar Stack
  // (login, onboarding) atau berupa alias (home → showcase). Daftar ini
  // sengaja pendek & berkomentar: setiap entri harus bisa dipertanggungjawabkan.
  const allowUnregistered = new Set<string>([
    "/login", // layar auth, selalu bisa di-replace
    "/onboarding",
    "/verify-email",
    "/deletion-status",
    "/home", // alias → /showcase
  ])

  const paths = [...new Set(registered.filter((r) => staticSegments(r).length > 0).map(samplePath))]

  it("self-loop hanya boleh di layar hub yang tercantum di sini", () => {
    // Daftar ini adalah INVENTARIS, bukan pembenaran: tiap entri adalah
    // layar puncak yang memang tidak punya induk berbeda. Menambah entri
    // berarti ada satu lagi layar yang tombol back-nya bisa nyangkut bila
    // dibuka dari cold start — pastikan <Header> menyembunyikan tombolnya.
    const knownHubs = [
      "/chat",
      "/disputes",
      "/faq",
      "/login",
      "/notifications",
      "/showcase",
      "/support",
      "/wallet",
    ]
    const loops = paths.filter((path) => {
      const parent = parentPathOf(path)
      return parent !== null && (parent === path || parent === `${path}/`)
    })
    expect(loops.sort()).toEqual(knownHubs)
  })

  it("setiap induk adalah rute yang benar-benar terdaftar", () => {
    const orphans = paths
      .map((path) => ({ path, parent: parentPathOf(path) }))
      .filter((entry) => {
        if (entry.parent === null) return true
        if (allowUnregistered.has(entry.parent)) return false
        return !matchesRegistered(entry.parent, registered)
      })
    expect(orphans).toEqual([])
  })

  it("induk tidak pernah kosong", () => {
    for (const path of paths) {
      expect(parentPathOf(path) ?? "", `induk untuk ${path}`).not.toBe("")
    }
  })
})
