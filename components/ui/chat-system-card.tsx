/**
 * Kahade — kartu pesan sistem (batch 43 FE-CHAT, 2026-09-28).
 *
 * Backend mengirim pesan SYSTEM otomatis untuk event transaksi:
 *   ✅ pembayaran diterima (dana dikunci escrow)
 *   📦 nomor resi diperbarui
 *   🚚 pesanan dikirim
 *   🎉 transaksi selesai (dana dicairkan) + RUANG OTOMATIS DIARSIPKAN
 *
 * Kartu terpusat dengan ikon per jenis event; untuk ORDER_COMPLETED ada
 * baris info eksplisit bahwa percakapan diarsipkan otomatis (item 6 —
 * pengguna tidak boleh mengira arsipnya manual/hilang).
 */
import { memo } from "react"
import { View } from "react-native"

import { detectChatSystemKind, chatSystemKindLabel, type ChatSystemKind } from "@/lib/chat-system"

import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import {
  CheckCircle,
  Package,
  Truck,
  Confetti,
  Receipt,
  Info,
  Archive,
} from "phosphor-react-native"

const KIND_ICON: Record<ChatSystemKind, typeof CheckCircle> = {
  ORDER_PAID: CheckCircle,
  ORDER_TRACKING_UPDATED: Package,
  ORDER_SHIPPED: Truck,
  ORDER_COMPLETED: Confetti,
  ORDER_FROM_CHAT: Receipt,
  GENERIC: Info,
}

export type ChatSystemCardProps = {
  text?: string
  className?: string
}

export const ChatSystemCard = memo(function ChatSystemCard({ text, className }: ChatSystemCardProps) {
  const kind = detectChatSystemKind(text)
  const icon = KIND_ICON[kind]
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${chatSystemKindLabel(kind)}: ${text ?? ""}`}
      className={`w-full items-center px-5 ${className ?? ""}`}
    >
      <View className="max-w-[92%] items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2.5">
        <View className="flex-row items-center gap-1.5">
          <Icon icon={icon} size={16} tone="accent" />
          <Text variant="caption" weight={700} tone="accent">
            {chatSystemKindLabel(kind)}
          </Text>
        </View>
        {text ? (
          <Text variant="caption" tone="secondary" className="text-center">
            {text}
          </Text>
        ) : null}
        {kind === "ORDER_COMPLETED" ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon icon={Archive} size={12} tone="default" />
            <Text variant="caption" tone="tertiary">
              Percakapan ini diarsipkan otomatis.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
})
