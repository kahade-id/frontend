/**
 * Test regresi untuk normalizer `POST /v1/orders/validate-counterpart`.
 *
 * Setiap kasus di sini adalah bentuk respons yang MEMBUAT FITUR MATI sebelum
 * normalizer ditambahkan: `res.valid` menjadi `undefined`, layar memetakannya ke
 * state "blocked", dan pengguna melihat "Pengguna ini tidak tersedia untuk
 * transaksi dengan Anda" untuk lawan transaksi yang sah.
 */
import { describe, expect, it } from "vitest"

import { normalizeCounterpartValidation } from "@/lib/api/orders"

describe("normalizeCounterpartValidation", () => {
  it("membaca flag `valid` standar", () => {
    const result = normalizeCounterpartValidation({
      valid: true,
      user: { id: "u1", username: "budi", fullName: "Budi", kycVerified: true },
    })
    expect(result.valid).toBe(true)
    expect(result.user?.id).toBe("u1")
    expect(result.user?.kycVerified).toBe(true)
  })

  it("membaca alias `isValid` — bentuk yang dulu membuat semua lawan transaksi 'blocked'", () => {
    const result = normalizeCounterpartValidation({
      isValid: true,
      user: { id: "u1", username: "budi" },
    })
    expect(result.valid).toBe(true)
  })

  it("membaca alias snake_case `is_valid`", () => {
    expect(normalizeCounterpartValidation({ is_valid: true, user: { username: "b" } }).valid).toBe(
      true,
    )
  })

  it("membuka pembungkus `data`/`validation` bersarang", () => {
    const result = normalizeCounterpartValidation({
      validation: { valid: true, user: { id: "u9", username: "sari" } },
    })
    expect(result.valid).toBe(true)
    expect(result.user?.username).toBe("sari")
  })

  it("TIDAK menyimpulkan 'diblokir' bila tidak ada flag tetapi profil user ada", () => {
    const result = normalizeCounterpartValidation({
      user: { id: "u2", username: "sari", fullName: "Sari" },
    })
    expect(result.valid).toBe(true)
    expect(result.notFound).toBeUndefined()
  })

  it("menghormati penanda blokir eksplisit", () => {
    expect(normalizeCounterpartValidation({ blocked: true, user: { username: "b" } }).valid).toBe(
      false,
    )
    expect(
      normalizeCounterpartValidation({ status: "SUSPENDED", user: { username: "b" } }).valid,
    ).toBe(false)
  })

  it("membedakan 'user tidak ada' dari 'user diblokir'", () => {
    const notFound = normalizeCounterpartValidation({ notFound: true, reason: "Tidak ditemukan" })
    expect(notFound.valid).toBe(false)
    expect(notFound.notFound).toBe(true)
    expect(notFound.reason).toBe("Tidak ditemukan")

    const userExistsFalse = normalizeCounterpartValidation({ userExists: false })
    expect(userExistsFalse.notFound).toBe(true)
  })

  it("KYC bukan penentu validitas — hanya informasi", () => {
    const result = normalizeCounterpartValidation({
      valid: true,
      user: { id: "u3", username: "tanpa-kyc", kycVerified: false },
    })
    expect(result.valid).toBe(true)
    expect(result.user?.kycVerified).toBe(false)
  })

  it("kycVerified tetap `undefined` bila backend tidak mengirimnya (bukan false)", () => {
    const result = normalizeCounterpartValidation({
      valid: true,
      user: { id: "u4", username: "budi" },
    })
    expect(result.user?.kycVerified).toBeUndefined()
  })

  it("menormalkan id dari `userId` dan alias avatar", () => {
    const result = normalizeCounterpartValidation({
      isValid: true,
      user: { userId: "u5", username: "budi", avatar_url: "https://x/y.png", avgRating: 4.8 },
    })
    expect(result.user?.id).toBe("u5")
    expect(result.user?.avatarUrl).toBe("https://x/y.png")
    expect(result.user?.rating).toBe(4.8)
  })

  it("respons kosong tidak melempar dan tidak mengklaim valid", () => {
    const result = normalizeCounterpartValidation(null)
    expect(result.valid).toBe(false)
    expect(result.user).toBeUndefined()
  })
})
