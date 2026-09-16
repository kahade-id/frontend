/**
 * Kahade — <ShowcaseFeedItem> (§9.17, §9.23).
 *
 * Kartu feed discover (GET /v1/showcase/feed): cover image di atas, lalu baris
 * judul + harga, meta penulis (avatar xs + nama), dan baris statistik
 * (like · komentar · dilihat). Kartu navigasi → layar detail (Push §10),
 * jadi memakai <Card href> agar di web dirender sebagai tautan sejati.
 *
 * Kenapa terpisah dari <UserDiscoverResultItem>: anatomi berbeda (kartu gambar,
 * bukan baris pengguna) sehingga menyalin pola baris tidak cocok. Statistik
 * memakai ikon 16px tone secondary + angka Mono tabular — monokrom §2.3,
 * tanpa warna "suka" merah (like aktif hanya muncul di halaman detail).
 */
import { Chat, Eye, HeartStraight } from "phosphor-react-native"

import { View } from "react-native"

import { formatNumber } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { resolveMediaUrl } from "@/lib/media"

import { Avatar } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Picture } from "@/components/ui/picture"
import { Text } from "@/components/ui/text"

export type ShowcaseFeedItemProps = {
  item: ShowcaseSocialItem
  onPress?: () => void
  /** Tautan web (opsional) — bila dikirim, kartu jadi <a href>. */
  href?: string
  className?: string
}

export function ShowcaseFeedItem({ item, onPress, href, className }: ShowcaseFeedItemProps) {
  const cover = item.images[0]?.imageUrl ?? item.coverImageUrl ?? item.imageUrl
  const resolvedCover = cover ? resolveMediaUrl(cover) : undefined
  const priceLabel =
    item.priceMin != null && item.priceMax != null && item.priceMin !== item.priceMax
      ? `Rp ${formatNumber(item.priceMin)} – ${formatNumber(item.priceMax)}`
      : item.priceMin != null
        ? `Rp ${formatNumber(item.priceMin)}`
        : "Harga lewat diskusi"

  return (
    <Card
      variant="default"
      padded={false}
      onPress={onPress}
      href={href}
      accessibilityLabel={`Showcase ${item.title}, ${priceLabel}, oleh ${item.author.fullName ?? item.author.username}`}
      className={className}
    >
      {resolvedCover ? (
        <Picture
          source={resolvedCover}
          alt={item.title}
          aspectRatio={4 / 3}
          radius="none"
        />
      ) : (
        <View className="h-44 items-center justify-center bg-surface">
          <Text variant="caption" tone="secondary">
            Tidak ada gambar
          </Text>
        </View>
      )}
      <View className="gap-2 p-3">
        <Text variant="body" weight={600} numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" tone="primary" weight={500}>
          {priceLabel}
        </Text>
        <View className="flex-row items-center gap-2">
          <Avatar
            source={item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined}
            name={item.author.fullName ?? item.author.username}
            size="xs"
            verified={item.author.isKycVerified === true}
          />
          <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
            {item.author.fullName ?? item.author.username}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Icon icon={HeartStraight} size="xs" tone="default" />
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {formatNumber(item.likeCount)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon icon={Chat} size="xs" tone="default" />
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {formatNumber(item.commentCount)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon icon={Eye} size="xs" tone="default" />
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {formatNumber(item.viewCount)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  )
}
