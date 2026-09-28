/**
 * Batch 43 FE-CHAT: klasifikasi pesan sistem (lapisan murni).
 */
import { describe, expect, it } from "vitest"
import { chatSystemKindLabel, detectChatSystemKind } from "@/lib/chat-system"

describe("detectChatSystemKind", () => {
  it("mendeteksi tiap event transaksi", () => {
    expect(detectChatSystemKind("✅ Pembayaran diterima. Dana dikunci di escrow.")).toBe("ORDER_PAID")
    expect(detectChatSystemKind("📦 Nomor resi diperbarui: 123.")).toBe("ORDER_TRACKING_UPDATED")
    expect(detectChatSystemKind("🚚 Pesanan dikirim.")).toBe("ORDER_SHIPPED")
    expect(detectChatSystemKind("🎉 Transaksi selesai. Dana dicairkan.")).toBe("ORDER_COMPLETED")
    expect(detectChatSystemKind("🧾 Order #KHD dibuat dari chat ini.")).toBe("ORDER_FROM_CHAT")
  })
  it("toleran spasi di depan", () => {
    expect(detectChatSystemKind("  🎉 selesai")).toBe("ORDER_COMPLETED")
  })
  it("fallback GENERIC", () => {
    expect(detectChatSystemKind("Pesan sistem tanpa emoji")).toBe("GENERIC")
    expect(detectChatSystemKind("")).toBe("GENERIC")
    expect(detectChatSystemKind(null)).toBe("GENERIC")
  })
})

describe("chatSystemKindLabel", () => {
  it("ada label untuk semua kind", () => {
    for (const k of [
      "ORDER_PAID",
      "ORDER_TRACKING_UPDATED",
      "ORDER_SHIPPED",
      "ORDER_COMPLETED",
      "ORDER_FROM_CHAT",
      "GENERIC",
    ] as const) {
      expect(chatSystemKindLabel(k).length).toBeGreaterThan(0)
    }
  })
})
