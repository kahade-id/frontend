/**
 * Kahade — <ShowcaseFeedItem> (§9.17, §9.23; revisi 2026-09-17).
 *
 * Satuan feed showcase bergaya POSTINGAN sosial (mockup docs/image/
 * IMG_20260917_224056_353.jpg) — BUKAN kartu: tanpa kotak border/background/
 * radius. Anatomi: media di atas (full-bleed — gutter dibawa pemanggil, lihat
 * ShowcaseFeedTab), lalu baris penulis (avatar + nama + username), judul
 * produk, harga, deskripsi singkat, dan baris statistik (suka · komentar).
 * Pemisah antar postingan adalah ruang (gap list), bukan garis maupun bayangan.
 *
 * Keputusan non-obvious:
 *   - Seluruh postingan satu target tap → detail (Push §10). Dengan `href`
 *     ia dirender sebagai tautan sejati di web (pola <Card href>): <a> yang
 *     bisa ctrl/cmd-klik, dan role-nya otomatis "link". Statistik TIDAK punya
 *     tombol sendiri di feed — like terjadi di halaman detail, jadi tidak ada
 *     nested-pressable.
 *   - Ikon statistik memakai tone "active" (tinta utama, bukan abu tertiary):
 *     di atas postingan tanpa kartu, ikon abu tampak "mati" — mockup
 *     menampilkan ikon tinta gelap. Angka tetap caption secondary tabular.
 *   - Grid media: 1 foto = kotak penuh 1:1; ≥2 foto = dua kolom 1:1 (gap
 *     2px), sisanya dihitung sebagai "+N" di atas scrim `bg-overlay-media`
 *     pada foto kedua — scrim 0.7 yang sama dengan <ShowcaseGalleryGrid>
 *     supaya label putih tetap ≥ 4.5:1 di atas foto terang.
 *   - Kolom grid memakai flex-1 (bukan w-1/2) agar gap terhitung otomatis;
 *     fraksi lebar + gap justru membuat kolom kedua wrap di RN.
 */
import { ChatCircle, HeartStraight } from "phosphor-react-native"
import { Link, type Href } from "expo-router"
import { View } from "react-native"

import { formatDateTime, formatNumber } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { resolveMediaUrl } from "@/lib/media"

import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

export type ShowcaseFeedItemProps = {
  item: ShowcaseSocialItem
  onPress?: () => void
  /** Tautan web (opsional) — bila dikirim, postingan jadi <a href>. */
  href?: Href
  className?: string
}

export function ShowcaseFeedItem({ item, onPress, href, className }: ShowcaseFeedItemProps) {
  const cover = item.images[0]?.imageUrl ?? item.coverImageUrl ?? item.imageUrl
  const resolvedCover = cover ? resolveMediaUrl(cover) : undefined
  // Galeri hanya berisi URL yang berhasil di-resolve — <Picture> butuh string
  // (bukan undefined), dan foto tanpa URL valid tidak boleh menyisakan slot.
  const gallery = item.images.flatMap((image) => {
    const url = resolveMediaUrl(image.imageUrl)
    return url ? [{ id: image.id, url }] : []
  })
  const priceLabel =
    item.priceMin != null && item.priceMax != null && item.priceMin !== item.priceMax
      ? `Rp ${formatNumber(item.priceMin)} – ${formatNumber(item.priceMax)}`
      : item.priceMin != null
        ? `Rp ${formatNumber(item.priceMin)}`
        : "Harga lewat diskusi"

  const images = gallery
  const overflow = images.length > 2 ? images.length - 2 : 0

  const body = (
    <View className={cn(className)}>
      {/* ── Media ── */}
      {images.length >= 2 ? (
        <View className="w-full flex-row gap-0.5">
          {[0, 1].map((slot) => {
            const image = images[slot]
            if (!image) return null
            return (
              <View key={image.id} className="flex-1">
                <Picture
                  source={image.url}
                  alt={item.title}
                  aspectRatio={1}
                  radius="none"
                  bordered={false}
                  recyclingKey={image.id}
                />
                {slot === 1 && overflow > 0 ? (
                  // Scrim 0.7 di atas foto terang tersusun ~#4D4D4D → label
                  // putih 8.4:1 (aritmetika sama dengan ShowcaseGalleryGrid).
                  <View style={{ pointerEvents: "none" }} className="absolute inset-0 items-center justify-center bg-overlay-media">
                    <Text variant="h3" tone="inherit" className="text-white">
                      {`+${formatNumber(overflow)}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : resolvedCover ? (
        <Picture
          source={resolvedCover}
          alt={item.title}
          aspectRatio={1}
          radius="none"
          bordered={false}
        />
      ) : (
        <View className="h-64 items-center justify-center bg-surface">
          <Text variant="caption" tone="secondary">
            Tidak ada gambar
          </Text>
        </View>
      )}

      {/* ── Penulis ── */}
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <Avatar
          source={item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined}
          name={item.author.fullName ?? item.author.username}
          size="md"
          verified={item.author.isKycVerified === true}
        />
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight={600} numberOfLines={1}>
            {item.author.fullName ?? item.author.username}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} className="tabular-nums">
            {`@${item.author.username} · ${formatDateTime(item.createdAt)}`}
          </Text>
        </View>
      </View>

      {/* ── Judul · harga · deskripsi ── */}
      <View className="gap-1 px-5 pt-3">
        <Text variant="body" weight={600} numberOfLines={2}>
          {item.title}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text variant="caption" tone="primary" weight={600}>
            {priceLabel}
          </Text>
          {item.category ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`· ${item.category}`}
            </Text>
          ) : null}
        </View>
        {item.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>

      {/* ── Statistik (bukan tombol — lihat catatan di atas) ── */}
      <View className="flex-row items-center gap-4 px-5 pb-1 pt-2">
        <View className="flex-row items-center gap-1.5">
          <Icon icon={HeartStraight} size="xs" tone="active" />
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {formatNumber(item.likeCount)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon icon={ChatCircle} size="xs" tone="active" />
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {formatNumber(item.commentCount)}
          </Text>
        </View>
      </View>
    </View>
  )

  if (href) {
    return (
      <Link href={href} asChild>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`Showcase ${item.title}, ${priceLabel}, oleh ${item.author.fullName ?? item.author.username}`}
          containerClassName={cn("w-full", focusRing)}
        >
          {body}
        </PressableScale>
      </Link>
    )
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Showcase ${item.title}, ${priceLabel}, oleh ${item.author.fullName ?? item.author.username}`}
      onPress={onPress}
      containerClassName={cn("w-full", focusRing)}
    >
      {body}
    </PressableScale>
  )
}
