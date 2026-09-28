/**
 * FE-IMP-4 item 18/21 — test murni `parseQrCode` (anti-phishing).
 */
import { describe, expect, it } from "vitest"

import { parseQrCode } from "@/lib/qr-parse"

describe("parseQrCode", () => {
  it("memetakan URL profil kahade.id", () => {
    const t = parseQrCode("https://kahade.id/user/budi_santoso")
    expect(t).toMatchObject({ type: "profile", username: "budi_santoso", risky: false })
  })

  it("memetakan URL transfer universal + nominal", () => {
    const t = parseQrCode("https://kahade.id/transfer?to=budi&amount=50000")
    expect(t).toMatchObject({ type: "transfer", username: "budi", amount: 50000 })
  })

  it("transfer tanpa nominal tetap valid", () => {
    const t = parseQrCode("https://kahade.id/transfer?to=budi")
    expect(t).toMatchObject({ type: "transfer", username: "budi", amount: undefined })
  })

  it("nominal tidak valid diabaikan (bukan NaN)", () => {
    const t = parseQrCode("https://kahade.id/transfer?to=budi&amount=-5")
    expect(t).toMatchObject({ type: "transfer", username: "budi", amount: undefined })
  })

  it("memetakan skema kahade://", () => {
    const t = parseQrCode("kahade://transfer?to=budi&amount=10000")
    expect(t.type).toBe("transfer")
  })

  it("memetakan order-link", () => {
    const t = parseQrCode("https://kahade.id/order-link/abc123XYZ")
    expect(t).toMatchObject({ type: "order-link", linkToken: "abc123XYZ" })
  })

  it("memetakan kode order telanjang", () => {
    const t = parseQrCode("KHD-8921")
    expect(t).toMatchObject({ type: "order", orderId: "KHD-8921" })
  })

  it("memetakan @username telanjang", () => {
    const t = parseQrCode("@budi_santoso")
    expect(t).toMatchObject({ type: "profile", username: "budi_santoso" })
  })

  it("URL asing TIDAK auto-aksi: external-url + risky", () => {
    const t = parseQrCode("https://evil-phish.example/login?next=kahade")
    expect(t.type).toBe("external-url")
    expect(t.risky).toBe(true)
    expect(t.url).toBe("https://evil-phish.example/login?next=kahade")
  })

  it("subdomain meniru kahade tetap dianggap asing", () => {
    const t = parseQrCode("https://kahade.id.evil.example/")
    expect(t.type).toBe("external-url")
  })

  it("path kahade.id tak dikenal menjadi teks", () => {
    const t = parseQrCode("https://kahade.id/admin/secret")
    expect(t.type).toBe("text")
  })

  it("skema asing (tel:) menjadi teks biasa", () => {
    const t = parseQrCode("tel:+628123456789")
    expect(t.type).toBe("text")
  })

  it("teks acak menjadi teks", () => {
    const t = parseQrCode("halo dunia")
    expect(t.type).toBe("text")
  })

  it("tidak pernah melempar untuk input aneh", () => {
    expect(() => parseQrCode("::: [[[ ")).not.toThrow()
    expect(() => parseQrCode("")).not.toThrow()
  })
})
