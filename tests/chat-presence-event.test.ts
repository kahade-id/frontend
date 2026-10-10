/**
 * Audit Pesan 2026-10-10 (#9b): event presence realtime (user.online /
 * user.offline) diterapkan walau presence awal belum ada, dan label tidak
 * jatuh ke "stale" selagi socket hidup (pemanggil mencap fetchedAt).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  applyPresenceEvent,
  PRESENCE_ONLINE_STALE_MS,
  presenceLabel,
} from "@/lib/chat-presence-label"

const ctx = { roomId: "room-1", nowIso: "2026-10-10T10:00:00.000Z" }

describe("applyPresenceEvent", () => {
  it("prev null (GET awal gagal/belum tiba) → event TIDAK dibuang", () => {
    expect(applyPresenceEvent(null, true, ctx)).toEqual({
      roomId: "room-1",
      userId: null,
      isOnline: true,
      lastSeenAt: null,
    })
  })

  it("online → pertahankan roomId/userId/lastSeenAt lama", () => {
    const prev = { roomId: "room-1", userId: "u-2", isOnline: false, lastSeenAt: "2026-10-10T09:00:00.000Z" }
    expect(applyPresenceEvent(prev, true, ctx)).toEqual({ ...prev, isOnline: true })
  })

  it("offline → lastSeenAt = sekarang (momen terakhir terlihat paling akurat)", () => {
    const prev = { roomId: "room-1", userId: "u-2", isOnline: true, lastSeenAt: null }
    expect(applyPresenceEvent(prev, false, ctx)).toEqual({
      ...prev,
      isOnline: false,
      lastSeenAt: ctx.nowIso,
    })
  })

  it("hasil + cap fetchedAt baru → label 'online' segar, bukan stale", () => {
    const now = Date.parse(ctx.nowIso)
    const staleFetchedAt = now - PRESENCE_ONLINE_STALE_MS - 1
    const prev = { roomId: "room-1", userId: null, isOnline: true, lastSeenAt: null }
    // Tanpa cap ulang (perilaku lama): stale walau socket baru bilang online.
    expect(presenceLabel(prev, staleFetchedAt, now)).toEqual({ kind: "stale" })
    // Dengan cap ulang saat event tiba (perilaku baru): online.
    const next = applyPresenceEvent(prev, true, ctx)
    expect(presenceLabel(next, now, now)).toEqual({ kind: "online" })
  })
})

describe("penyambungan ke layar ruang chat (guard sumber)", () => {
  const room = readFileSync(
    resolve(process.cwd(), "components/screens/chat-room-screen.tsx"),
    "utf8",
  )

  it("onPresence memakai applyPresenceEvent dan mencap fetchedAt", () => {
    expect(room).toMatch(
      /onPresence: \(isOnline\) => \{\s*\n\s*setPresence\(\(prev\) =>\s*\n\s*applyPresenceEvent\(prev, isOnline, \{/,
    )
    expect(room).toMatch(/applyPresenceEvent\([\s\S]{0,200}?\)\s*,?\s*\)\s*\n\s*setPresenceFetchedAt\(Date\.now\(\)\)/)
    // Pola lama yang membuang event saat prev null — harus hilang.
    expect(room).not.toContain("(prev ? { ...prev, isOnline } : prev)")
  })
})
