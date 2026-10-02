/**
 * Test murni — SLA tiket dalam bahasa pengguna (F12).
 */
import { describe, expect, it } from "vitest"

import { describeTicketSla, nextOwnerLabel } from "@/lib/ticket-sla"
import type { SupportTicket } from "@/lib/api/support"

const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: "t1",
  ticketNumber: "TK-000001",
  subject: "Subjek",
  status: "OPEN",
  updatedAt: "2026-09-28T00:00:00.000Z",
  ...over,
})

describe("describeTicketSla", () => {
  it("OPEN → pemilik Tim Kahade, pengguna tak perlu bertindak", () => {
    const s = describeTicketSla(ticket({ status: "OPEN" }))
    expect(s.nextOwner).toBe("agent")
    expect(nextOwnerLabel(s.nextOwner)).toBe("Tim Kahade")
    expect(s.nextStep.length).toBeGreaterThan(0)
  })

  // SYS-A-002: WAITING_USER bukan nilai backend — case-nya dihapus dari
  // describeTicketSla. Status "menunggu balasan user" adalah state UI klien
  // (ESI-017), bukan dari API.

  it("IN_PROGRESS → pemilik agen", () => {
    expect(describeTicketSla(ticket({ status: "IN_PROGRESS" })).nextOwner).toBe("agent")
  })

  it("RESOLVED/CLOSED → tidak ada pemilik langkah", () => {
    expect(describeTicketSla(ticket({ status: "RESOLVED" })).nextOwner).toBe("none")
    expect(describeTicketSla(ticket({ status: "CLOSED" })).nextOwner).toBe("none")
  })

  it("tanpa field SLA dari server → responseDueLabel undefined (jujur)", () => {
    const s = describeTicketSla(ticket({ status: "OPEN" }))
    expect(s.responseDueLabel).toBeUndefined()
  })

  it("field slaDueAt dari server dipakai bila ada", () => {
    const s = describeTicketSla(
      ticket({ status: "OPEN", slaDueAt: "2026-09-29T10:00:00.000Z" }) as SupportTicket & Record<string, unknown>,
    )
    expect(s.responseDueLabel).toBeDefined()
  })
})
