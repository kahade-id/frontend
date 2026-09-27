/**
 * Kahade — uji keamanan tautan deskripsi etalase (SEC-402).
 *
 * Dua lapis pertahanan diuji:
 *  1. `safeHttpsLink()` (lib/external-url.ts) — validator call-site yang
 *     dipakai `ShowcaseHtmlView` sebelum `Linking.openURL`. Hanya `https:`
 *     yang lolos; `javascript:`, `intent:`, `data:`, dan URL berkredensial
 *     ditolak.
 *  2. `parseShowcaseHtmlBlocks()` / `sanitizeShowcaseHtml()` (lib/showcase-html.ts)
 *     — parser internal (`safeHref`) sudah membuang href non-http(s) SEBELUM
 *     segmen dibuat, termasuk upaya entity-encoding (`&#106;avascript:`).
 */
import { describe, expect, it } from "vitest"

import { safeHttpsLink } from "../lib/external-url"
import { parseShowcaseHtmlBlocks, sanitizeShowcaseHtml } from "../lib/showcase-html"

function hrefsOf(html: string): (string | undefined)[] {
  return parseShowcaseHtmlBlocks(html).flatMap((b) => b.segments.map((s) => s.href))
}

describe("safeHttpsLink (SEC-402 call-site validator)", () => {
  it("meloloskan https biasa", () => {
    expect(safeHttpsLink("https://kahade.id/etalase/123")).toBe("https://kahade.id/etalase/123")
  })

  it("menolak javascript:", () => {
    expect(safeHttpsLink("javascript:alert(1)")).toBeUndefined()
    expect(safeHttpsLink("JaVaScRiPt:alert(1)")).toBeUndefined()
  })

  it("menolak intent:", () => {
    expect(safeHttpsLink("intent://scan/#Intent;scheme=zxing;end")).toBeUndefined()
  })

  it("menolak data:", () => {
    expect(safeHttpsLink("data:text/html,<script>alert(1)</script>")).toBeUndefined()
  })

  it("menolak http (hanya https yang diizinkan di call-site ini)", () => {
    expect(safeHttpsLink("http://kahade.id/")).toBeUndefined()
  })

  it("menolak URL berkredensial yang menyembunyikan tujuan", () => {
    expect(safeHttpsLink("https://user:pass@kahade.id/")).toBeUndefined()
  })

  it("menolak nilai bukan-string / kosong / relatif", () => {
    expect(safeHttpsLink("")).toBeUndefined()
    expect(safeHttpsLink(undefined)).toBeUndefined()
    expect(safeHttpsLink("/etalase/123")).toBeUndefined()
  })
})

describe("parser showcase-html (safeHref internal, SEC-402 lapis pertama)", () => {
  it("mempertahankan href https", () => {
    expect(hrefsOf('<a href="https://kahade.id/promo">promo</a>')).toContain(
      "https://kahade.id/promo",
    )
  })

  it("membuang href javascript: — segmen jadi teks biasa tanpa href", () => {
    const hrefs = hrefsOf('<a href="javascript:alert(document.cookie)">klik</a>')
    expect(hrefs.every((h) => h === undefined)).toBe(true)
  })

  it("membuang href intent: dan data:", () => {
    expect(
      hrefsOf('<a href="intent://x#Intent;end">a</a><a href="data:text/html,x">b</a>').every(
        (h) => h === undefined,
      ),
    ).toBe(true)
  })

  it("tidak bisa diakali entity-encoding (cek dilakukan pada atribut mentah)", () => {
    // &#106; = "j" — bila parser men-decode dulu sebelum cek skema, ini lolos.
    const hrefs = hrefsOf('<a href="&#106;avascript:alert(1)">klik</a>')
    expect(hrefs.every((h) => h === undefined)).toBe(true)
  })

  it("sanitizeShowcaseHtml membuang script/iframe dan event handler", () => {
    const clean = sanitizeShowcaseHtml(
      '<p onclick="alert(1)">x</p><script>alert(1)</script><iframe src="https://evil.id"></iframe>',
    )
    expect(clean).not.toMatch(/onclick/i)
    expect(clean).not.toMatch(/<script/i)
    expect(clean).not.toMatch(/<iframe/i)
  })

  it("sanitizeShowcaseHtml idempoten", () => {
    const html = '<p><b>halo</b> <a href="https://kahade.id">tautan</a></p>'
    expect(sanitizeShowcaseHtml(sanitizeShowcaseHtml(html))).toBe(sanitizeShowcaseHtml(html))
  })
})
