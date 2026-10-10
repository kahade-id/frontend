/**
 * Audit Pesan 2026-10-10 (#9a): mark-as-read sadar fokus — centang ganda ke
 * lawan bicara hanya bila pesan benar-benar tampil (layar fokus, aplikasi
 * aktif, viewport di dasar thread).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { canMarkRead, readActionForIncoming } from "@/lib/chat-read-gate"

const open = { focused: true, appActive: true, atBottom: true }

describe("canMarkRead", () => {
  it("terbuka hanya bila fokus + aktif + di dasar", () => {
    expect(canMarkRead(open)).toBe(true)
    expect(canMarkRead({ ...open, focused: false })).toBe(false)
    expect(canMarkRead({ ...open, appActive: false })).toBe(false)
    expect(canMarkRead({ ...open, atBottom: false })).toBe(false)
  })
})

describe("readActionForIncoming", () => {
  it("tidak ada pesan baru dari lawan → none (gema sendiri/poll kosong tidak menandai)", () => {
    expect(readActionForIncoming({ added: 0, freshFromOther: true, gate: open })).toBe("none")
    expect(readActionForIncoming({ added: 2, freshFromOther: false, gate: open })).toBe("none")
  })

  it("pesan baru + gate terbuka → mark", () => {
    expect(readActionForIncoming({ added: 1, freshFromOther: true, gate: open })).toBe("mark")
  })

  it("pesan baru + aplikasi di latar / layar tertutup / sedang menelusuri → defer", () => {
    expect(
      readActionForIncoming({ added: 1, freshFromOther: true, gate: { ...open, appActive: false } }),
    ).toBe("defer")
    expect(
      readActionForIncoming({ added: 1, freshFromOther: true, gate: { ...open, focused: false } }),
    ).toBe("defer")
    expect(
      readActionForIncoming({ added: 1, freshFromOther: true, gate: { ...open, atBottom: false } }),
    ).toBe("defer")
  })
})

describe("penyambungan ke layar ruang chat (guard sumber)", () => {
  const room = readFileSync(
    resolve(process.cwd(), "components/screens/chat-room-screen.tsx"),
    "utf8",
  )

  it("gate dibaca dari fokus layar (useIsFocused) dan AppState", () => {
    expect(room).toMatch(/import \{[^}]*useIsFocused[^}]*\} from "expo-router"/)
    expect(room).toContain("const isFocused = useIsFocused()")
    expect(room).toMatch(/appActiveRef\.current = state === "active"/)
  })

  it("pesan masuk lewat readActionForIncoming; yang tertahan dicatat & dilunasi", () => {
    expect(room).toContain("readActionForIncoming({")
    expect(room).toMatch(/else if \(readAction === "defer"\) \{\s*\n\s*deferredReadRef\.current = true/)
    // Dilunasi saat fokus kembali DAN saat aplikasi aktif kembali.
    expect(room).toMatch(/if \(isFocused\) flushDeferredRead\(\)/)
    expect(room).toMatch(/if \(state === "active"\) \{\s*\n\s*flushDeferredRead\(\)/)
  })

  it("tidak ada lagi mark-as-read pesan masuk yang hanya bersyarat atBottom", () => {
    expect(room).not.toMatch(/result\.hasFreshFromOther &&\s*\n\s*roomIdRef\.current &&\s*\n\s*atBottomRef\.current/)
  })
})
