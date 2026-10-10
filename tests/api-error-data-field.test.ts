/**
 * RK-01 (audit etalase 2026-10-10): `errors.data` dari envelope backend
 * (HttpExceptionFilter) ikut diparse ke `ApiError.data` — dipakai 409
 * suka/simpan ({liked, likeCount} / {saved, saveCount}) dan 403
 * SHOWCASE_MODERATED ({reportId}). Copy SHOWCASE_MODERATED jujur, bukan
 * "tidak punya akses" generik.
 */
import { describe, expect, it } from "vitest"

import { ApiError, parseErrorBody, userMessage } from "@/lib/api/errors"

const envelope = {
  success: false,
  message: "Already liked",
  data: null,
  errors: { code: "SHOWCASE_ALREADY_LIKED", message: "Already liked", data: { liked: true, likeCount: 12 } },
}

describe("parseErrorBody — errors.data", () => {
  it("objek datar di errors.data dibaca; data:null level atas diabaikan", () => {
    const parsed = parseErrorBody(envelope)
    expect(parsed.backendCode).toBe("SHOWCASE_ALREADY_LIKED")
    expect(parsed.data).toEqual({ liked: true, likeCount: 12 })
  })

  it("tanpa errors.data → undefined (bukan null level atas, bukan array)", () => {
    expect(parseErrorBody({ success: false, message: "x", data: null, errors: { code: "X", message: "x" } }).data).toBeUndefined()
    expect(parseErrorBody({ success: false, message: "x", data: null, errors: { code: "X", message: "x", data: [1] } }).data).toBeUndefined()
    expect(parseErrorBody("teks polos").data).toBeUndefined()
  })

  it("ApiError menyimpan data dari init", () => {
    const err = new ApiError({ code: "CONFLICT", message: "x", backendCode: "SHOWCASE_ALREADY_SAVED", data: { saved: true, saveCount: 3 } })
    expect(err.data).toEqual({ saved: true, saveCount: 3 })
    expect(new ApiError({ code: "CONFLICT", message: "x" }).data).toBeUndefined()
  })
})

describe("userMessage — SHOWCASE_MODERATED", () => {
  it("403 item ditindak moderator → copy spesifik (bukan FORBIDDEN generik)", () => {
    const err = new ApiError({
      code: "FORBIDDEN",
      status: 403,
      message: "Showcase item is under moderation enforcement",
      clientMessage: false,
      backendCode: "SHOWCASE_MODERATED",
      data: { reportId: "r1" },
    })
    expect(userMessage(err)).toBe("Etalase ini sedang ditindak moderator dan tidak bisa diubah untuk sementara.")
  })
})
