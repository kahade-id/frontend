/**
 * Kahade — uji redaksi telemetry frontend (Grup F G483/G492).
 *
 * Menjamin tidak ada PII/token yang lolos ke sink telemetry (Sentry dsb):
 * field terlarang, pola email/HP Indonesia/NIK/nomor kartu diredaksi,
 * object circular tidak crash, kedalaman dibatasi.
 */
import { describe, expect, it } from "vitest"
import { redactTelemetryEvent, redactValue } from "../lib/telemetry-redaction"

describe("redactTelemetryEvent (G492)", () => {
  it("meredaksi field terlarang tanpa menghapus field aman", () => {
    const out = redactTelemetryEvent({
      event: "login.failed",
      route: "/v1/auth/login",
      statusCode: 401,
      phoneNumber: "081234567890",
      token: "jwt-secret",
      password: "rahasia",
      otp: "123456",
    } as any)
    expect(out.route).toBe("/v1/auth/login")
    expect(out.statusCode).toBe(401)
    expect(out.phoneNumber).toBe("[REDACTED]")
    expect(out.token).toBe("[REDACTED]")
    expect(out.password).toBe("[REDACTED]")
    expect(out.otp).toBe("[REDACTED]")
  })

  it("meredaksi pola email, HP Indonesia, NIK, nomor kartu di string bebas", () => {
    expect(redactValue("hubungi budi@example.com ya")).toBe(
      "hubungi [REDACTED] ya",
    )
    expect(redactValue("no saya 081234567890")).toBe("no saya [REDACTED]")
    expect(redactValue("nik 3174051201900001")).toBe("nik [REDACTED]")
    expect(redactValue("kartu 4111111111111111")).toBe("kartu [REDACTED]")
  })

  it("rekursif ke object/array nested", () => {
    const out = redactTelemetryEvent({
      event: "x",
      message: "m",
      nested: { deep: { email: "a@b.co" } },
      list: ["ok", "user 6281234567890"],
    } as any)
    expect(out.nested.deep.email).toBe("[REDACTED]")
    expect(out.list).toEqual(["ok", "user [REDACTED]"])
  })

  it("aman terhadap object circular", () => {
    const a: any = { name: "safe" }
    a.self = a
    expect(() =>
      redactTelemetryEvent({ event: "x", message: "m", a } as any),
    ).not.toThrow()
    const out = redactTelemetryEvent({ event: "x", message: "m", a } as any)
    expect(out.a.self).toBe("[Circular]")
  })

  it("tidak mengubah event tanpa PII (idempoten untuk data aman)", () => {
    const evt = { event: "screen.view", message: "", screen: "Home", latencyMs: 12 }
    const out = redactTelemetryEvent(evt)
    expect(out).toEqual(evt)
  })
})
