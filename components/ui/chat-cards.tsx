/**
 * Kahade — kartu produk & kartu order di chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Snapshot dibekukan backend saat pesan dikirim (`card` di ChatMessage) —
 * harga/judul TIDAK di-fetch ulang, jadi kartu tetap jujur walau etalase
 * berubah/dihapus setelahnya.
 *
 *   - Kartu produk: gambar, judul, rentang harga, penjual; tombol
 *     "Lihat" → detail etalase, "Beli" → sheet buat transaksi escrow
 *     (uang HANYA lewat escrow — tidak ada kirim uang langsung).
 *   - Kartu order: kode order, judul, status, nominal; tombol "Lihat" →
 *     detail order (pakai ID internal cuid dari snapshot).
 */
import { memo } from "react"
import { Pressable, View } from "react-native"
import { useRouter } from "expo-router"

import type { ChatOrderCardPayload, ChatProductCardPayload } from "@/lib/api/chat"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"

import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { Picture } from "@/components/ui/picture"
import { Badge } from "@/components/ui/badge"
import { Storefront, Receipt, ArrowSquareOut } from "phosphor-react-native"

function priceLabel(card: ChatProductCardPayload): string {
  const min = card.priceMin != null ? Number(card.priceMin) : NaN
  const max = card.priceMax != null ? Number(card.priceMax) : NaN
  if (Number.isFinite(min) && Number.isFinite(max) && min !== max)
    return `${formatRupiah(min)} – ${formatRupiah(max)}`
  if (Number.isFinite(min)) return formatRupiah(min)
  return "Harga lihat etalase"
}

export type ChatProductCardProps = {
  card: ChatProductCardPayload
  outgoing?: boolean
  /** "Beli" — layar membuka sheet buat transaksi escrow. */
  onBuy?: (card: ChatProductCardPayload) => void
}

export const ChatProductCard = memo(function ChatProductCard({
  card,
  outgoing = false,
  onBuy,
}: ChatProductCardProps) {
  const router = useRouter()
  const openShowcase = () => router.push(ROUTES.showcaseDetail(card.showcaseId))
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Kartu produk: ${card.title}, ${priceLabel(card)}`}
      className={`overflow-hidden rounded-sm border ${
        outgoing ? "border-white/20 bg-black/10" : "border-border bg-background"
      }`}
    >
      {card.imageUrl ? (
        <Picture
          source={card.imageUrl}
          alt={card.title}
          aspectRatio={16 / 9}
          radius="none"
          bordered={false}
        />
      ) : null}
      <View className="gap-1 p-2.5">
        <View className="flex-row items-center gap-1">
          <Icon icon={Storefront} size={12} tone={outgoing ? "inverse" : "default"} />
          <Text
            variant="caption"
            tone={outgoing ? "inverse" : "secondary"}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            @{card.sellerUsername}
          </Text>
        </View>
        <Text
          variant="body"
          weight={600}
          tone={outgoing ? "inverse" : "primary"}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {card.title}
        </Text>
        <Text variant="body" weight={700} tone="accent">
          {priceLabel(card)}
        </Text>
        <View className="mt-1 flex-row gap-2">
          <Pressable
            onPress={openShowcase}
            accessibilityRole="button"
            accessibilityLabel="Lihat etalase"
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-sm py-2 ${
              outgoing ? "bg-black/15" : "bg-surface"
            }`}
          >
            <Icon icon={ArrowSquareOut} size={14} tone={outgoing ? "inverse" : "active"} />
            <Text variant="caption" weight={700} tone={outgoing ? "inverse" : "primary"}>
              Lihat
            </Text>
          </Pressable>
          {onBuy ? (
            <Pressable
              onPress={() => onBuy(card)}
              accessibilityRole="button"
              accessibilityLabel={`Beli ${card.title} via escrow`}
              className="flex-1 items-center justify-center rounded-sm bg-primary py-2"
            >
              <Text variant="caption" weight={700} tone="inverse">
                Beli
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
})

export type ChatOrderCardProps = {
  card: ChatOrderCardPayload
  outgoing?: boolean
}

export const ChatOrderCard = memo(function ChatOrderCard({
  card,
  outgoing = false,
}: ChatOrderCardProps) {
  const router = useRouter()
  const value = Number(card.orderValue)
  return (
    <Pressable
      onPress={() => router.push(ROUTES.orderDetail(card.orderId))}
      accessibilityRole="button"
      accessibilityLabel={`Kartu order ${card.orderCode}: ${card.title}. Buka detail order.`}
      className={`gap-1.5 rounded-sm border p-2.5 ${
        outgoing ? "border-white/20 bg-black/10" : "border-border bg-background"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5">
          <Icon icon={Receipt} size={14} tone="accent" />
          <Text variant="caption" weight={700} tone={outgoing ? "inverse" : "primary"}>
            {card.orderCode}
          </Text>
        </View>
        <Badge tone="info">{card.status}</Badge>
      </View>
      <Text
        variant="body"
        weight={600}
        tone={outgoing ? "inverse" : "primary"}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {card.title}
      </Text>
      <Text variant="body" weight={700} tone="accent">
        {Number.isFinite(value) ? formatRupiah(value) : card.orderValue}
      </Text>
      <Text variant="caption" weight={600} tone={outgoing ? "inverse" : "info"}>
        Lihat detail order →
      </Text>
    </Pressable>
  )
})
