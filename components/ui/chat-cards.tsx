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
        // UX-COL-013: pola CHT-013 — border putih tak terlihat di dark
        // (bubble putih), bg hitam tak terlihat di light (bubble hitam).
        outgoing ? "border-white/20 dark:border-black/20 bg-white/10 dark:bg-black/10" : "border-border bg-background"
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
        {/*
          CHT-012: snapshot optimistis bisa belum tahu username penjual
          (profil gagal dimuat) — baris "@" kosong disembunyikan daripada
          tampil "@" menggantung.
        */}
        {card.sellerUsername ? (
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
        ) : null}
        <Text
          variant="body"
          weight={600}
          tone={outgoing ? "inverse" : "primary"}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {card.title}
        </Text>
        {/*
          CHT-002: harga memakai tone accent TANPA mempertimbangkan outgoing —
          accent.text = #000000 (light) / #FFFFFF (dark), SAMA dengan warna
          bubble keluar (bg-primary) → hitam-di-atas-hitam / putih-di-atas-putih.
          Di bubble sendiri pakai "inverse" (mode-aware: putih di light,
          hitam di dark) seperti semua teks lain di kartu ini.
        */}
        <Text variant="body" weight={700} tone={outgoing ? "inverse" : "accent"}>
          {priceLabel(card)}
        </Text>
        <View className="mt-1 flex-row gap-2">
          <Pressable
            onPress={openShowcase}
            accessibilityRole="button"
            accessibilityLabel="Lihat etalase"
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-sm py-2 ${
              // CHT-013: overlay harus terlihat di KEDUA mode — bubble keluar
              // hitam (light) / putih (dark), jadi bg-black/15 saja hanya
              // terlihat di dark. Putih-translusen di light, hitam di dark.
              outgoing ? "bg-white/15 dark:bg-black/15" : "bg-surface"
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
              // CHT-013: bg-primary di atas bubble keluar (bg-primary) membuat
              // bentuk tombol tak terlihat. Overlay translusen mode-aware
              // (pola sama dengan tombol "Lihat"): putih/15 di light (bubble
              // hitam), hitam/15 di dark (bubble putih).
              className={`flex-1 items-center justify-center rounded-sm py-2 ${
                outgoing ? "bg-white/15 dark:bg-black/15" : "bg-primary"
              }`}
            >
              <Text variant="caption" weight={700} tone="inverse">
                Beli via Escrow
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
      accessibilityLabel={`Kartu pesanan ${card.orderCode}: ${card.title}. Buka detail pesanan.`}
      className={`gap-1.5 rounded-sm border p-2.5 ${
        // UX-COL-013: pola CHT-013 — border putih tak terlihat di dark
        // (bubble putih), bg hitam tak terlihat di light (bubble hitam).
        outgoing ? "border-white/20 dark:border-black/20 bg-white/10 dark:bg-black/10" : "border-border bg-background"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5">
          {/* CHT-002: sama seperti harga — accent tak terbaca di bubble
              sendiri; pakai inverse saat outgoing. */}
          <Icon icon={Receipt} size={14} tone={outgoing ? "inverse" : "accent"} />
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
      {/* CHT-002: nominal — tone accent tak terbaca di bubble sendiri. */}
      <Text variant="body" weight={700} tone={outgoing ? "inverse" : "accent"}>
        {Number.isFinite(value) ? formatRupiah(value) : card.orderValue}
      </Text>
      <Text variant="caption" weight={600} tone={outgoing ? "inverse" : "info"}>
        Lihat detail order →
      </Text>
    </Pressable>
  )
})
