/**
 * Guard regresi proteksi rute (B-01/B-06 audit 2026-09-20).
 *
 * Sebelumnya 5 rute ber-auth (`settings`, `receive`, `saved`,
 * `showcase-management`, `profile/[id]`) tidak terdaftar di
 * AUTHENTICATED_SCREENS dan tidak ada test yang menyadarinya. Test ini
 * membandingkan inventaris file app/ (sumber kebenaran rute) dengan registri
 * proteksi + allowlist publik EKSPLisit:
 *   - rute baru tanpa keputusan proteksi → test gagal (bukan bolong diam-diam)
 *   - entri registri yang file-nya sudah tidak ada → test gagal (stale guard)
 *   - perilaku isProtectedPath untuk tamu web dikunci sampel per kategori.
 */
import { readdirSync, statSync, existsSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

import {
  AUTHENTICATED_SCREENS,
  WEB_GUEST_ALLOWED_PATHS,
  WEB_GUEST_TAB_SCREENS,
  isProtectedPath,
} from "@/lib/protected-routes"
import { TAB_ROUTE_NAMES } from "@/lib/routes"

const APP_DIR = join(process.cwd(), "app")

/** Rute yang SENGAJA publik — setiap entri adalah keputusan yang terdokumentasi. */
const PUBLIC_SCREENS = new Set<string>([
  // Infrastruktur router
  "index",
  "+not-found",
  "+html",
  "_layout",
  // Alur auth pra-sesi (setup-profile terdaftar protected — butuh token)
  "(auth)/create-security",
  "(auth)/forgot-password",
  "(auth)/login",
  "(auth)/onboarding",
  "(auth)/profile-data",
  "(auth)/register",
  "(auth)/reset-password",
  "(auth)/verify-2fa",
  "(auth)/verify-otp",
  "(auth)/whatsapp-trigger",
  // Konten publik/legal/corong akuisisi
  "home", // redirect /home → /showcase (Beranda dihapus 2026-09-23); publik seperti tujuannya
  "about",
  "app-version", // info versi (GET /v1/public/app-version, auth none)
  "appearance", // preferensi tema lokal, tanpa API ber-auth
  "contact",
  "faq",
  "feedback",
  "help/[slug]",
  "live-support",
  "login-required",
  "privacy-policy",
  "terms",
  "verify-email", // alur auth email
  "showcase/[id]", // corong share/SEO publik — detail karya bisa dilihat tamu
  "user/[username]/showcase", // galeri etalase publik (audit Etalase 2026-09-23, I-05)
  // R2 (audit ronde-2, butir #69): preview order-link publik (auth:"none") —
  // corong share wajib bisa dibuka tamu; aksi Terima/Tolak digerbang sesi di
  // dalam layar (dialihkan ke login membawa next-path).
  "order-link/[token]",
  "scan",
])

function collectRoutes(dir: string, prefix = ""): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(full).isDirectory()) {
      result.push(...collectRoutes(full, rel))
      continue
    }
    if (!entry.endsWith(".tsx") && !entry.endsWith(".ts")) continue
    const name = rel.replace(/\.(tsx|ts)$/, "")
    if (name.endsWith("/_layout") || name === "_layout") continue
    result.push(name)
  }
  return result
}

describe("AUTHENTICATED_SCREENS vs inventaris app/", () => {
  const routes = collectRoutes(APP_DIR).filter((name) => !name.startsWith("(tabs)/"))
  const registered = new Set<string>(AUTHENTICATED_SCREENS)

  it("setiap rute ber-auth terdaftar atau eksplisit publik", () => {
    const unaccounted = routes.filter(
      (name) => !registered.has(name) && !PUBLIC_SCREENS.has(name),
    )
    expect(unaccounted).toEqual([])
  })

  it("tidak ada entri registri yang menunjuk file yang tidak ada (guard stale)", () => {
    const stale = [...registered].filter((name) => {
      if (name === "(tabs)") return !existsSync(join(APP_DIR, "(tabs)"))
      // Entri tab ("discover", "showcase", …) fisiknya hidup di app/(tabs)/.
      const candidates = [
        `${name}.tsx`,
        `${name}.ts`,
        join(name, "index.tsx"),
        join("(tabs)", `${name}.tsx`),
        join("(tabs)", name, "index.tsx"),
      ]
      return !candidates.some((candidate) => existsSync(join(APP_DIR, candidate)))
    })
    expect(stale).toEqual([])
  })

  it("semua rute sensitif yang dulu bolong kini terdaftar (regresi B-01)", () => {
    for (const name of [
      "settings",
      "receive",
      "saved",
      "showcase-management",
      "profile/[id]",
      "notifications",
    ]) {
      expect(registered.has(name), `${name} harus terdaftar`).toBe(true)
    }
  })
})

describe("isProtectedPath (guest web)", () => {
  it("memblokir layar akun", () => {
    for (const path of [
      "/settings",
      "/receive",
      "/saved",
      "/showcase-management",
      "/notifications",
      "/profile/123",
      "/user/budi",
      "/transfer",
      "/withdraw",
      "/topup",
      "/wallet-history",
      "/kyc",
      "/chat",
      "/chat/room-1",
      "/order/abc",
      "/settings?tab=security",
    ]) {
      expect(isProtectedPath(path), `${path} harus terproteksi`).toBe(true)
    }
  })

  it("membiarkan corong publik & tab tamu", () => {
    for (const path of [
      "/",
      "/home",
      "/transactions",
      "/wallet",
      "/discover",
      "/search",
      "/faq",
      "/help/mulai-escrow",
      "/about",
      "/terms",
      "/privacy-policy",
      "/login",
      "/register",
      "/showcase", // tab Etalase publik (audit Etalase 2026-09-23) — feed auth:"none"
      "/showcase/abc", // detail karya = corong share publik
    ]) {
      expect(isProtectedPath(path), `${path} harus publik`).toBe(false)
    }
  })

  it("setiap path yang diizinkan eksplisit memang tidak terproteksi", () => {
    for (const path of WEB_GUEST_ALLOWED_PATHS) {
      expect(isProtectedPath(path), `${path} masuk allowlist tapi terblokir`).toBe(false)
    }
  })

  it("notifications tidak lagi diizinkan untuk tamu (regresi B-01)", () => {
    expect(WEB_GUEST_TAB_SCREENS).not.toContain("notifications")
  })

  it("tab yang dilindungi diturunkan dari TAB_ROUTE_NAMES, bukan hardcode (B-11)", () => {
    // Revisi audit Etalase (2026-09-23): tab "showcase" kini PUBLIK untuk
    // tamu web — feed-nya memang auth:"none" dan detail item sudah lebih
    // dulu publik. Yang tetap terproteksi adalah turunannya
    // (/showcase-management) dan aksi sosial di dalamnya (digate sesi).
    expect(TAB_ROUTE_NAMES).toContain("showcase")
    expect(isProtectedPath("/showcase")).toBe(false)
    expect(isProtectedPath("/showcase-management")).toBe(true)
    // Tab tamu tetap terbuka.
    for (const tab of WEB_GUEST_TAB_SCREENS) {
      expect(isProtectedPath(`/${tab}`)).toBe(false)
    }
  })
})

describe("konsistensi registri", () => {
  it("relative() tidak dipakai untuk melompat keluar app/ (sanity)", () => {
    expect(relative(APP_DIR, join(APP_DIR, "settings.tsx")).split(sep)[0]).toBe("settings.tsx")
  })
})
