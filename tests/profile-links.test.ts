/**
 * Tautan profil (lib/profile-links.ts) — bug "link di profil tidak muncul".
 *
 *  - `normalizeProfileLinks`: membaca bagian `links` GET /v1/users/{username}
 *    (array atau amplop {links}), fail-closed (https saja), urut displayOrder,
 *    tanpa duplikat platform.
 *  - `normalizeSocialLinkInput` / `isValidSocialLinkInput`: input editor
 *    disamakan dengan kontrak PUT /v1/users/me/links (https wajib; nomor
 *    WhatsApp → wa.me; tanpa skema → https://; http:// ditolak).
 *
 * Dijalankan sebagai unit test node via `npm test` (vitest).
 */
import { describe, expect, it } from "vitest"

import {
  isValidSocialLinkInput,
  normalizeProfileLinks,
  normalizeSocialLinkInput,
  profileLinkText,
} from "@/lib/profile-links"

describe("normalizeProfileLinks", () => {
  it("membaca array links backend dan mengurutkan displayOrder", () => {
    const out = normalizeProfileLinks([
      { id: "b", platform: "website", url: "https://tokobudi.id", label: null, displayOrder: 1 },
      { id: "a", platform: "instagram", url: "https://instagram.com/budi", label: "IG Budi", displayOrder: 0 },
    ])
    expect(out.map((l) => l.platform)).toEqual(["instagram", "website"])
    expect(out[0]).toMatchObject({ id: "a", label: "IG Budi", url: "https://instagram.com/budi" })
  })

  it("menerima amplop {links} (bentuk GET /v1/users/me/links)", () => {
    const out = normalizeProfileLinks({ links: [{ platform: "x", url: "https://x.com/budi" }] })
    expect(out).toHaveLength(1)
    expect(out[0].displayOrder).toBe(0)
  })

  it("fail-closed: buang non-https, skema berbahaya, dan entri rusak", () => {
    const out = normalizeProfileLinks([
      { platform: "website", url: "http://insecure.id" },
      { platform: "tiktok", url: "javascript:alert(1)" },
      { platform: "", url: "https://kosong.id" },
      { platform: "shop", url: 42 },
      null,
      "bukan objek",
      { platform: "telegram", url: "https://t.me/budi" },
    ])
    // displayOrder tidak dikirim → posisi hasil (0), bukan indeks sumber.
    expect(out).toEqual([
      { platform: "telegram", url: "https://t.me/budi", label: null, displayOrder: 0 },
    ])
  })

  it("membuang duplikat platform (yang pertama menang) dan menormalkan huruf", () => {
    const out = normalizeProfileLinks([
      { platform: "Instagram", url: "https://instagram.com/a" },
      { platform: "instagram", url: "https://instagram.com/b" },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe("https://instagram.com/a")
  })

  it("payload tanpa links → array kosong (bukan crash)", () => {
    expect(normalizeProfileLinks(undefined)).toEqual([])
    expect(normalizeProfileLinks(null)).toEqual([])
    expect(normalizeProfileLinks({})).toEqual([])
  })
})

describe("profileLinkText", () => {
  it("label pemilik menang, selain itu domain tanpa www", () => {
    expect(profileLinkText({ platform: "website", url: "https://www.tokobudi.id/x", label: "Toko" })).toBe("Toko")
    expect(profileLinkText({ platform: "website", url: "https://www.tokobudi.id/x", label: "  " })).toBe("tokobudi.id")
  })
})

describe("normalizeSocialLinkInput", () => {
  it("nomor WhatsApp lokal → https://wa.me/62…", () => {
    expect(normalizeSocialLinkInput("whatsapp", "0812-3456-7890")).toBe("https://wa.me/6281234567890")
    expect(normalizeSocialLinkInput("whatsapp", "+62 812 3456 7890")).toBe("https://wa.me/6281234567890")
  })

  it("tautan wa.me untuk WhatsApp dibiarkan", () => {
    expect(normalizeSocialLinkInput("whatsapp", "https://wa.me/628123")).toBe("https://wa.me/628123")
  })

  it("tanpa skema → ditambah https://; https dibiarkan; http dibiarkan agar ditolak validasi", () => {
    expect(normalizeSocialLinkInput("instagram", "instagram.com/budi")).toBe("https://instagram.com/budi")
    expect(normalizeSocialLinkInput("website", " https://tokobudi.id ")).toBe("https://tokobudi.id")
    expect(normalizeSocialLinkInput("website", "http://tokobudi.id")).toBe("http://tokobudi.id")
  })
})

describe("isValidSocialLinkInput — sama dengan aturan backend (https wajib)", () => {
  it("menerima https, tanpa skema, dan nomor WhatsApp", () => {
    expect(isValidSocialLinkInput("instagram", "https://instagram.com/budi")).toBe(true)
    expect(isValidSocialLinkInput("instagram", "instagram.com/budi")).toBe(true)
    expect(isValidSocialLinkInput("whatsapp", "081234567890")).toBe(true)
  })

  it("menolak http://, kosong, tanpa domain, dan URL berkredensial", () => {
    expect(isValidSocialLinkInput("website", "http://tokobudi.id")).toBe(false)
    expect(isValidSocialLinkInput("website", "")).toBe(false)
    expect(isValidSocialLinkInput("website", "budi")).toBe(false)
    expect(isValidSocialLinkInput("website", "https://user:pw@tokobudi.id")).toBe(false)
    expect(isValidSocialLinkInput("tiktok", "javascript:alert(1)")).toBe(false)
  })
})
