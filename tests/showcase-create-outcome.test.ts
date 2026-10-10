/**
 * CR-02 (audit etalase 2026-10-10): OfflineError = request TIDAK pernah
 * dikirim → bukan "status simpan belum pasti" (dulu seluruh form terkunci
 * hanya karena NetInfo offline).
 */
import { describe, expect, it } from "vitest"

import { ApiError, OfflineError } from "@/lib/api/errors"
import { classifyCreateFailure } from "@/lib/showcase-create-outcome"

const api = (code: ApiError["code"], status?: number) => new ApiError({ code, status, message: "x" })

describe("classifyCreateFailure", () => {
  it("OfflineError → not-sent (form boleh dicoba lagi, kunci dibuang)", () => {
    expect(classifyCreateFailure(new OfflineError())).toBe("not-sent")
  })

  it("penolakan tegas server → rejected", () => {
    for (const status of [400, 401, 403, 404, 413, 422, 429]) {
      expect(classifyCreateFailure(api("BAD_REQUEST", status))).toBe("rejected")
    }
  })

  it("timeout / koneksi putus / 5xx / 409 → uncertain (kunci idempotency dipakai ulang)", () => {
    expect(classifyCreateFailure(api("TIMEOUT"))).toBe("uncertain")
    expect(classifyCreateFailure(api("NETWORK"))).toBe("uncertain")
    expect(classifyCreateFailure(api("SERVER", 500))).toBe("uncertain")
    expect(classifyCreateFailure(api("CONFLICT", 409))).toBe("uncertain")
    expect(classifyCreateFailure(new Error("boom"))).toBe("uncertain")
  })

  it("ApiError klien tanpa status (validasi payload) → not-sent", () => {
    expect(classifyCreateFailure(api("VALIDATION"))).toBe("not-sent")
  })
})
