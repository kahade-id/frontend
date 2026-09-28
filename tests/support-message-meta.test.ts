/**
 * Test murni — label peran + waktu pesan dukungan (F16).
 */
import { describe, expect, it } from "vitest"

import {
  resolveSupportSenderRole,
  supportMessageAbsoluteTime,
  supportMessageRelativeTime,
  supportRoleLabel,
} from "@/lib/support-message-meta"

describe("resolveSupportSenderRole", () => {
  it("fromUser → user", () => {
    expect(resolveSupportSenderRole({ fromUser: true })).toBe("user")
  })

  it("pesan masuk tanpa penanda → agent (fallback jujur)", () => {
    expect(resolveSupportSenderRole({ fromUser: false })).toBe("agent")
  })

  it("isBot → bot", () => {
    expect(resolveSupportSenderRole({ fromUser: false, isBot: true })).toBe("bot")
  })

  it("senderRole 'bot' → bot", () => {
    expect(resolveSupportSenderRole({ fromUser: false, senderRole: "bot" })).toBe("bot")
  })

  it("forceBot mengalahkan segalanya (sapaan otomatis klien)", () => {
    expect(resolveSupportSenderRole({ fromUser: false }, true)).toBe("bot")
  })
})

describe("supportRoleLabel", () => {
  it("label tiga peran", () => {
    expect(supportRoleLabel("user")).toBe("Anda")
    expect(supportRoleLabel("bot")).toBe("Asisten Otomatis")
    expect(supportRoleLabel("agent")).toBe("Tim Kahade")
  })
})

describe("waktu pesan", () => {
  it("relatif dan absolut keduanya string non-kosong dan berbeda", () => {
    const at = "2026-09-27T10:00:00.000Z"
    const rel = supportMessageRelativeTime(at)
    const abs = supportMessageAbsoluteTime(at)
    expect(rel.length).toBeGreaterThan(0)
    expect(abs.length).toBeGreaterThan(0)
    expect(rel).not.toBe(abs)
  })
})
