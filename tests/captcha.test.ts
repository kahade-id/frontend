/**
 * Regresi captcha slider (laporan pengguna: "Saat ubah password —
 * Couldn't send the code / Captcha verification is required").
 *
 * Akar masalah: backend memakai captcha SLIDER dan selalu mewajibkannya pada
 * `POST /v1/auth/forgot-password` (juga `register`; `login` setelah 3 gagalan
 * per IP), sementara adapter dulu:
 *   1. mengubah respons `{ challengeId, targetX }` menjadi `captchaId: undefined`
 *      (tipe lama mengharapkan `captchaId` + `image`), dan
 *   2. layar tidak pernah mengirim `captchaId`/`captchaAnswer` sama sekali.
 * Akibatnya setiap permintaan dijawab 401 `CAPTCHA_REQUIRED` — pesan mentah
 * backend yang muncul di UI sebagai kegagalan "kirim kode".
 *
 * Yang dikunci di sini:
 *   1. `generateCaptcha()` memetakan `challengeId`/`targetX` (termasuk bentuk
 *      terbungkus `{ data }` dan snake_case) dan MENOLAK bentuk tak dikenal
 *      alih-alih mengembalikan `captchaId` kosong;
 *   2. `forgotPassword()` meneruskan `captchaId` + `captchaAnswer` apa adanya
 *      di body, karena backend memvalidasinya lewat class-validator.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMock = {
  get: vi.fn(),
  post: vi.fn(),
}

vi.mock("@/lib/api/client", () => ({ http: httpMock }))

const { generateCaptcha, forgotPassword } = await import("@/lib/api/auth")

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
})

describe("generateCaptcha", () => {
  it("memetakan challengeId/targetX dari backend menjadi captchaId", async () => {
    httpMock.post.mockResolvedValue({ challengeId: "11111111-2222-3333-4444-555555555555", targetX: 47 })

    const challenge = await generateCaptcha()

    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/auth/captcha/generate")
    expect(challenge.captchaId).toBe("11111111-2222-3333-4444-555555555555")
    expect(challenge.targetX).toBe(47)
  })

  it("menerima respons terbungkus `data` dan field snake_case", async () => {
    httpMock.post.mockResolvedValue({
      data: { challenge_id: "abc", target_x: 23, expires_at: "2026-09-16T00:00:00Z" },
    })

    const challenge = await generateCaptcha()

    expect(challenge.captchaId).toBe("abc")
    expect(challenge.targetX).toBe(23)
    expect(challenge.expiresAt).toBe("2026-09-16T00:00:00Z")
  })

  it("melempar bila id tantangan tidak ada — captcha tanpa id pasti ditolak backend", async () => {
    httpMock.post.mockResolvedValue({ targetX: 40 })

    await expect(generateCaptcha()).rejects.toMatchObject({ code: "PARSE" })
  })

  it("melempar bila targetX bukan angka", async () => {
    httpMock.post.mockResolvedValue({ challengeId: "abc", targetX: "47" })

    await expect(generateCaptcha()).rejects.toMatchObject({ code: "PARSE" })
  })
})

describe("forgotPassword", () => {
  it("mengirim captchaId dan captchaAnswer bersama email", async () => {
    httpMock.post.mockResolvedValue({ message: "ok" })

    await forgotPassword({ email: "budi@example.com", captchaId: "abc", captchaAnswer: 61 })

    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/auth/forgot-password")
    expect(httpMock.post.mock.calls[0][1]).toEqual({
      email: "budi@example.com",
      captchaId: "abc",
      captchaAnswer: 61,
    })
  })
})
