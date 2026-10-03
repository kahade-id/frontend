/**
 * TIM CHAT — perbaikan bubble chat 2026-09-27 (keluhan pemakaian nyata).
 *
 * Mengunci kontrak presentasi & interaksi (TANPA logika chat/payload/API):
 *  a. simetri margin kiri/kanan bubble masuk vs keluar,
 *  b. ketukan bubble teks = no-op; aksi (menu/reaksi) hanya via tekan lama,
 *  c. popover reaksi mengambang di dekat bubble (tidak menutupi layar),
 *  d. badge reaksi overlap di sudut bubble (bukan baris di bawah bubble).
 * Timestamp tiap bubble diuji lewat komponen <ChatMessageRow> tersendiri.
 *
 * Diuji lewat `@/lib/chat-bubble` — modul murni yang DIKONSUMSI langsung oleh
 * <ChatMessageBubble>, <ChatMessageRow>, dan <ChatReactionPopover>.
 */
import { describe, expect, it, vi } from "vitest"

import {
  CHAT_AVATAR_COLUMN_PX,
  CHAT_BUBBLE_MAX_WIDTH_PCT,
  CHAT_MESSAGE_GUTTER_PX,
  REACTION_BADGE_ANCHOR,
  REACTION_BADGE_CLEARANCE_PX,
  REACTION_POPOVER_EST_WIDTH,
  chatBubbleGeometry,
  placeReactionPopover,
  resolveBubblePressHandlers,
  type ChatBubbleAnchor,
} from "@/lib/chat-bubble"

describe("simetri bubble incoming/outgoing", () => {
  it("gutter luar & lebar maksimum IDENTIK untuk kedua arah", () => {
    const incoming = chatBubbleGeometry("incoming")
    const outgoing = chatBubbleGeometry("outgoing")
    expect(incoming.gutter).toBe(CHAT_MESSAGE_GUTTER_PX)
    expect(outgoing.gutter).toBe(CHAT_MESSAGE_GUTTER_PX)
    expect(incoming.gutter).toBe(outgoing.gutter)
    expect(incoming.maxWidthPct).toBe(CHAT_BUBBLE_MAX_WIDTH_PCT)
    expect(outgoing.maxWidthPct).toBe(CHAT_BUBBLE_MAX_WIDTH_PCT)
    expect(incoming.maxWidthPct).toBe(outgoing.maxWidthPct)
  })

  it("hanya penyelarasannya yang di-mirror (kiri vs kanan)", () => {
    expect(chatBubbleGeometry("incoming").align).toBe("start")
    expect(chatBubbleGeometry("outgoing").align).toBe("end")
  })

  it("kolom avatar masuk akal (24px avatar + 8px gap, di dalam batas 76%)", () => {
    expect(CHAT_AVATAR_COLUMN_PX).toBe(32)
  })
})

describe("ketuk vs tekan lama pada bubble teks", () => {
  const anchor: ChatBubbleAnchor = { x: 10, y: 200, width: 180, height: 48 }

  it("di luar mode pilih: KETUKAN no-op (onPress undefined), tekan lama membuka aksi", () => {
    const onTap = vi.fn()
    const onLongPress = vi.fn()
    const h = resolveBubblePressHandlers({
      selecting: false,
      onTap,
      onLongPress,
    })
    expect(h.onPress).toBeUndefined()
    expect(h.onLongPressAt).toBeDefined()
    h.onLongPressAt!(anchor)
    expect(onLongPress).toHaveBeenCalledWith(anchor)
    expect(onTap).not.toHaveBeenCalled()
  })

  it("saat mode pilih aktif: ketukan men-toggle pilihan", () => {
    const onTap = vi.fn()
    const h = resolveBubblePressHandlers({
      selecting: true,
      onTap,
      onLongPress: vi.fn(),
    })
    expect(h.onPress).toBeDefined()
    h.onPress!()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it("pesan terhapus: tidak ada handler sama sekali", () => {
    const h = resolveBubblePressHandlers({
      selecting: true,
      isDeleted: true,
      onTap: vi.fn(),
      onLongPress: vi.fn(),
    })
    expect(h.onPress).toBeUndefined()
    expect(h.onLongPressAt).toBeUndefined()
  })
})

describe("badge reaksi overlap di sudut bubble", () => {
  it("posisinya absolute (mengambang), bukan di bawah bubble", () => {
    expect(REACTION_BADGE_ANCHOR.position).toBe("absolute")
  })

  it("bottom negatif = menimpa sudut bubble, menempel di kanan", () => {
    expect(REACTION_BADGE_ANCHOR.bottom).toBeLessThan(0)
    expect(REACTION_BADGE_ANCHOR.right).toBeGreaterThanOrEqual(0)
  })

  it("clearance bawah bubble menutup juluran badge", () => {
    expect(REACTION_BADGE_CLEARANCE_PX).toBeGreaterThanOrEqual(
      -REACTION_BADGE_ANCHOR.bottom,
    )
  })
})

describe("popover reaksi mengambang di dekat bubble", () => {
  const winW = 360
  const winH = 640

  it("di atas bubble bila ruang cukup (tidak menutupi bubble)", () => {
    const anchor: ChatBubbleAnchor = { x: 100, y: 400, width: 160, height: 48 }
    const { top, left } = placeReactionPopover(anchor, winW, winH, REACTION_POPOVER_EST_WIDTH)
    expect(top + 56).toBeLessThanOrEqual(anchor.y)
    // Menempel horizontal di tengah bubble, dijepit ke dalam layar.
    expect(left).toBeGreaterThanOrEqual(8)
    expect(left + REACTION_POPOVER_EST_WIDTH).toBeLessThanOrEqual(winW - 8)
  })

  it("jatuh ke bawah bubble bila di dekat puncak layar", () => {
    const anchor: ChatBubbleAnchor = { x: 100, y: 20, width: 160, height: 48 }
    const { top } = placeReactionPopover(anchor, winW, winH, REACTION_POPOVER_EST_WIDTH)
    expect(top).toBeGreaterThanOrEqual(anchor.y + anchor.height)
  })

  it("fallback koordinat sentuh (width/height 0) tetap di dekat titik tekan", () => {
    const anchor: ChatBubbleAnchor = { x: 200, y: 300, width: 0, height: 0 }
    const { top, left } = placeReactionPopover(anchor, winW, winH, REACTION_POPOVER_EST_WIDTH)
    expect(Math.abs(top - 300)).toBeLessThan(200)
    expect(left).toBeGreaterThanOrEqual(8)
  })
})
