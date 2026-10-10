/**
 * CR-07 / CR-08 (audit etalase 2026-10-10): payload editor "Ubah detail".
 */
import { describe, expect, it } from "vitest"

import { buildShowcaseUpdatePayload, visibilityFromRaw, type ShowcaseEditForm } from "@/lib/showcase-edit-payload"

const form: ShowcaseEditForm = {
  title: "Sepatu",
  description: "  bagus  ",
  priceMin: 100000,
  priceMax: null,
  category: "  Sneakers   lokal ",
  isPublic: true,
  condition: "",
}

describe("visibilityFromRaw", () => {
  it("PUBLIC/PRIVATE diketahui; absen/asing = privat di layar tetapi TIDAK diketahui", () => {
    expect(visibilityFromRaw("PUBLIC")).toEqual({ isPublic: true, known: true })
    expect(visibilityFromRaw("PRIVATE")).toEqual({ isPublic: false, known: true })
    expect(visibilityFromRaw(undefined)).toEqual({ isPublic: false, known: false })
    expect(visibilityFromRaw("FOLLOWERS")).toEqual({ isPublic: false, known: false })
  })
})

describe("buildShowcaseUpdatePayload", () => {
  it("CR-07: tidak pernah mengirim media[] / imageFileKeys (PUT media = replace penuh)", () => {
    const payload = buildShowcaseUpdatePayload({ title: "Sepatu", form, initialVisibility: visibilityFromRaw("PUBLIC") })
    expect(payload).not.toHaveProperty("media")
    expect(payload).not.toHaveProperty("imageFileKeys")
    expect(payload).toMatchObject({ title: "Sepatu", description: "bagus", category: "Sneakers lokal", priceMin: 100000, priceMax: 100000 })
  })

  it("CR-08: visibility absen di respons & sakelar tidak disentuh → visibility TIDAK dikirim", () => {
    const initial = visibilityFromRaw(undefined)
    const payload = buildShowcaseUpdatePayload({ title: "Sepatu", form: { ...form, isPublic: initial.isPublic }, initialVisibility: initial })
    expect(payload).not.toHaveProperty("visibility")
  })

  it("CR-08: visibility absen tetapi pengguna menyalakan sakelar → PUBLIC dikirim", () => {
    const initial = visibilityFromRaw(undefined)
    const payload = buildShowcaseUpdatePayload({ title: "Sepatu", form: { ...form, isPublic: true }, initialVisibility: initial })
    expect(payload.visibility).toBe("PUBLIC")
  })

  it("visibility diketahui → selalu dikirim apa adanya (PRIVATE tetap PRIVATE)", () => {
    const initial = visibilityFromRaw("PRIVATE")
    const payload = buildShowcaseUpdatePayload({ title: "Sepatu", form: { ...form, isPublic: false }, initialVisibility: initial })
    expect(payload.visibility).toBe("PRIVATE")
  })

  it("kondisi hanya dikirim bila dipilih; deskripsi disanitasi bila diminta", () => {
    const sanitize = (s: string) => s.replace(/<[^>]+>/g, "")
    const payload = buildShowcaseUpdatePayload({
      title: "Sepatu",
      form: { ...form, description: "<b>x</b>", condition: "BARU" },
      initialVisibility: visibilityFromRaw("PUBLIC"),
      sanitizeDescription: sanitize,
    })
    expect(payload.condition).toBe("BARU")
    expect(payload.description).toBe("x")
    expect(buildShowcaseUpdatePayload({ title: "S", form, initialVisibility: visibilityFromRaw("PUBLIC") })).not.toHaveProperty("condition")
  })
})
