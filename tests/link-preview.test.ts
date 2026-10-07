/**
 * Pratinjau tautan chat — kontrak `lib/link-preview.ts`.
 *
 * Mengunci: ekstraksi URL pertama (termasuk pangkas tanda baca), decode
 * entity, dan parse Open Graph (plus fallback title/meta description).
 */
import { describe, expect, it } from "vitest"

import { decodeEntities, extractFirstUrl, parseOpenGraph } from "@/lib/link-preview"

describe("extractFirstUrl", () => {
  it("null untuk teks tanpa URL", () => {
    expect(extractFirstUrl(null)).toBeNull()
    expect(extractFirstUrl(undefined)).toBeNull()
    expect(extractFirstUrl("halo apa kabar")).toBeNull()
  })
  it("mengambil URL pertama", () => {
    expect(extractFirstUrl("lihat https://kahade.id/a dan https://x.id/b")).toBe("https://kahade.id/a")
  })
  it("memangkas tanda baca penutup kalimat", () => {
    expect(extractFirstUrl("buka https://kahade.id/a.")).toBe("https://kahade.id/a")
    expect(extractFirstUrl("buka https://kahade.id/a, lalu")).toBe("https://kahade.id/a")
    expect(extractFirstUrl("(lihat https://kahade.id/a)")).toBe("https://kahade.id/a")
    expect(extractFirstUrl('klik "https://kahade.id/a" ya')).toBe("https://kahade.id/a")
  })
  it("mempertahankan tanda kurung seimbang (mis. Wikipedia)", () => {
    expect(extractFirstUrl("https://id.wikipedia.org/wiki/Kucing_(disambiguasi)")).toBe(
      "https://id.wikipedia.org/wiki/Kucing_(disambiguasi)",
    )
  })
})

describe("decodeEntities", () => {
  it("decode entity umum + rapikan spasi", () => {
    expect(decodeEntities("Kahade &amp; Mitra")).toBe("Kahade & Mitra")
    expect(decodeEntities("a&nbsp;&nbsp;b")).toBe("a b")
    expect(decodeEntities("&lt;tag&gt; &quot;x&quot;")).toBe('<tag> "x"')
  })
})

describe("parseOpenGraph", () => {
  it("membaca og:title/description/image", () => {
    const html = `<html><head>
      <meta property="og:title" content="Judul Situs" />
      <meta property="og:description" content="Deskripsi &amp; info" />
      <meta property="og:image" content="https://cdn.id/og.jpg" />
      <meta property="og:site_name" content="Situsku" />
    </head></html>`
    expect(parseOpenGraph(html, "https://situs.id/a")).toEqual({
      title: "Judul Situs",
      description: "Deskripsi & info",
      siteName: "Situsku",
      image: "https://cdn.id/og.jpg",
    })
  })
  it("urutan atribut terbalik tetap terbaca", () => {
    const html = `<meta content="Judul Terbalik" property="og:title" />`
    expect(parseOpenGraph(html, "https://s.id/").title).toBe("Judul Terbalik")
  })
  it("fallback <title> + meta description", () => {
    const html = `<html><head><title>Halaman Tanpa OG</title>
      <meta name="description" content="Deskripsi biasa" /></head></html>`
    expect(parseOpenGraph(html, "https://s.id/")).toEqual({
      title: "Halaman Tanpa OG",
      description: "Deskripsi biasa",
    })
  })
  it("og:image relatif diselesaikan ke absolut; http ditolak", () => {
    const html = `<meta property="og:image" content="/img/og.jpg" />`
    expect(parseOpenGraph(html, "https://s.id/a").image).toBe("https://s.id/img/og.jpg")
    const http = `<meta property="og:image" content="http://s.id/img.jpg" />`
    expect(parseOpenGraph(http, "https://s.id/a").image).toBeUndefined()
  })
  it("tanpa metadata → objek kosong", () => {
    expect(parseOpenGraph("<html><body>kosong</body></html>", "https://s.id/")).toEqual({})
  })
})
