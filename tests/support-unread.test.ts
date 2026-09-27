/**
 * Test murni — penanda unread tiket dukungan (item 126).
 * Aturan: unread bila aktivitas terakhir > waktu buka tersimpan; belum pernah
 * dibuka = belum dibaca.
 */
import { describe, expect, it } from "vitest"

import {
  getSupportOpenedAt,
  isSupportTicketUnread,
  markSupportTicketOpened,
  supportTicketActivityMs,
} from "@/lib/support-unread"

const T = (iso: string) => iso

describe("supportTicketActivityMs", () => {
  it("mengambil yang terbaru dari updatedAt dan pesan", () => {
    expect(
      supportTicketActivityMs({
        updatedAt: T("2026-09-27T10:00:00Z"),
        messages: [{ createdAt: T("2026-09-27T12:00:00Z") }, { createdAt: T("2026-09-26T09:00:00Z") }],
      }),
    ).toBe(new Date("2026-09-27T12:00:00Z").getTime())
  })

  it("0 bila tidak ada timestamp valid", () => {
    expect(supportTicketActivityMs({ updatedAt: "bukan-tanggal", messages: [] })).toBe(0)
    expect(supportTicketActivityMs({})).toBe(0)
  })
})

describe("isSupportTicketUnread", () => {
  const ticket = { id: "tk-1", updatedAt: T("2026-09-27T12:00:00Z"), messages: [] as { createdAt?: string | null }[] }
  const activity = new Date("2026-09-27T12:00:00Z").getTime()

  it("unread bila belum pernah dibuka", () => {
    expect(isSupportTicketUnread(ticket, {})).toBe(true)
  })

  it("unread bila aktivitas lebih baru dari waktu buka", () => {
    expect(isSupportTicketUnread(ticket, { "tk-1": activity - 1 })).toBe(true)
  })

  it("read bila waktu buka >= aktivitas", () => {
    expect(isSupportTicketUnread(ticket, { "tk-1": activity })).toBe(false)
    expect(isSupportTicketUnread(ticket, { "tk-1": activity + 1_000 })).toBe(false)
  })

  it("read bila tiket tanpa aktivitas dan belum pernah dibuka", () => {
    expect(isSupportTicketUnread({ id: "tk-2" }, {})).toBe(false)
  })
})

describe("markSupportTicketOpened / getSupportOpenedAt", () => {
  it("roundtrip menyimpan timestamp buka", async () => {
    await markSupportTicketOpened("tk-x", 1_700_000_000_000)
    const map = await getSupportOpenedAt()
    expect(map["tk-x"]).toBe(1_700_000_000_000)
  })

  it("menandai unread ter-reset setelah dibuka", async () => {
    const ticket = { id: "tk-y", updatedAt: T("2026-09-27T12:00:00Z"), messages: [] as { createdAt?: string | null }[] }
    expect(isSupportTicketUnread(ticket, await getSupportOpenedAt())).toBe(true)
    await markSupportTicketOpened("tk-y", new Date("2026-09-27T13:00:00Z").getTime())
    expect(isSupportTicketUnread(ticket, await getSupportOpenedAt())).toBe(false)
  })
})
