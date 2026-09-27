/**
 * Kahade — klasifikasi pesan sistem (batch 43 FE-CHAT, 2026-09-28).
 *
 * Backend mengirim pesan SYSTEM otomatis untuk event transaksi:
 *   ✅ Pembayaran diterima → dana dikunci escrow
 *   📦 Nomor resi diperbarui
 *   🚚 Pesanan dikirim
 *   🎉 Transaksi selesai → dana dicairkan
 * plus (frontend) 🧾 order dibuat dari chat.
 *
 * Murni (tanpa RN) — bisa di-unit-test di Node.
 */

export type ChatSystemKind =
  | "ORDER_PAID"
  | "ORDER_TRACKING_UPDATED"
  | "ORDER_SHIPPED"
  | "ORDER_COMPLETED"
  | "ORDER_FROM_CHAT"
  | "GENERIC"

const PREFIX_KIND: [string, ChatSystemKind][] = [
  ["✅", "ORDER_PAID"],
  ["📦", "ORDER_TRACKING_UPDATED"],
  ["🚚", "ORDER_SHIPPED"],
  ["🎉", "ORDER_COMPLETED"],
  ["🧾", "ORDER_FROM_CHAT"],
]

/** Klasifikasikan pesan sistem dari awalan emoji. Fallback GENERIC. */
export function detectChatSystemKind(content: string | null | undefined): ChatSystemKind {
  const text = (content ?? "").trimStart()
  for (const [prefix, kind] of PREFIX_KIND) {
    if (text.startsWith(prefix)) return kind
  }
  return "GENERIC"
}

/** Label aksesibilitas/ringkas per jenis pesan sistem. */
export function chatSystemKindLabel(kind: ChatSystemKind): string {
  switch (kind) {
    case "ORDER_PAID":
      return "Pembayaran diterima"
    case "ORDER_TRACKING_UPDATED":
      return "Resi diperbarui"
    case "ORDER_SHIPPED":
      return "Pesanan dikirim"
    case "ORDER_COMPLETED":
      return "Transaksi selesai"
    case "ORDER_FROM_CHAT":
      return "Order dibuat"
    case "GENERIC":
      return "Info sistem"
  }
}
