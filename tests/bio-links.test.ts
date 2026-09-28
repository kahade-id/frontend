/**
 * Test Batch 139 E04 — helper tautan bio (lib/bio-links.ts).
 */
import { describe, expect, it } from "vitest"

import { bioHasLinks, extractBioSegments, getUrlDomain } from "@/lib/bio-links"

describe("getUrlDomain", () => {
  it("mengambil host tanpa www dan huruf kecil", () => {
    expect(getUrlDomain("https://WWW.Tokopedia.com/produk/123")).toBe("tokopedia.com")
  })
  it("mempertahankan subdomain selain www", () => {
    expect(getUrlDomain("https://blog.kahade.id/a")).toBe("blog.kahade.id")
  })
  it("menolak skema non-http", () => {
    expect(getUrlDomain("javascript:alert(1)")).toBeNull()
    expect(getUrlDomain("ftp://example.com/x")).toBeNull()
  })
  it("menolak string bukan URL", () => {
    expect(getUrlDomain("bukan url")).toBeNull()
    expect(getUrlDomain("")).toBeNull()
  })
})

describe("extractBioSegments", () => {
  it("teks tanpa URL menjadi satu segmen teks", () => {
    expect(extractBioSegments("Halo, saya penjual kopi.")).toEqual([
      { kind: "text", text: "Halo, saya penjual kopi." },
    ])
  })
  it("URL http(s) menjadi segmen link dengan domain", () => {
    const segments = extractBioSegments("Kunjungi https://tokopedia.com/toko saya ya")
    expect(segments).toEqual([
      { kind: "text", text: "Kunjungi " },
      { kind: "link", url: "https://tokopedia.com/toko", domain: "tokopedia.com" },
      { kind: "text", text: " saya ya" },
    ])
  })
  it("tanda baca di ujung URL tidak ikut menjadi tautan", () => {
    const segments = extractBioSegments("Lihat https://kahade.id/x.")
    expect(segments).toEqual([
      { kind: "text", text: "Lihat " },
      { kind: "link", url: "https://kahade.id/x", domain: "kahade.id" },
      { kind: "text", text: "." },
    ])
  })
  it("beberapa URL dipecah berurutan", () => {
    const segments = extractBioSegments("https://a.id/1 dan https://b.id/2")
    expect(segments.filter((s) => s.kind === "link")).toHaveLength(2)
    expect(segments[0]).toEqual({ kind: "link", url: "https://a.id/1", domain: "a.id" })
  })
  it("skema javascript: tidak di-linkify", () => {
    const segments = extractBioSegments("klik javascript:alert(1) ya")
    expect(segments.every((s) => s.kind === "text")).toBe(true)
  })
  it("URL tanpa skema tidak di-linkify", () => {
    const segments = extractBioSegments("toko saya di tokopedia.com/abc")
    expect(segments.every((s) => s.kind === "text")).toBe(true)
  })
})

describe("bioHasLinks", () => {
  it("true bila ada tautan http(s)", () => {
    expect(bioHasLinks("cek https://kahade.id")).toBe(true)
  })
  it("false bila tidak ada tautan", () => {
    expect(bioHasLinks("tidak ada tautan di sini")).toBe(false)
  })
})
