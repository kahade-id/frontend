/**
 * Kahade — <ShowcaseFeedItem> (§9.17, §9.23; revisi 2026-09-17 #3).
 *
 * Revisi #3 — 9 poin showcase:
 *  1. Header collapsing sampai tab (feed tab header lives inside ShowcaseFeedTab — worklet)
 *  2. Media KARTU swipe (mx-5 rounded-sm, selaras avatar & simpan) — bukan full-bleed +N
 *  3. Separator inset di ATAS & BAWAH bar aksi (mx-5, bukan full)
 *  4. Tap avatar/nama → profil pembuat
 *  7. Count di samping ikon (horizontal) — bukan di bawah
 *  8. preventDownload pada gambar showcase
 *  9. Ikon laporkan di kanan tanggal
 *
 * Revisi 2026-09-18 — poin 7 belum benar-benar terjadi di layar: angka suka/
 * komentar tetap jatuh ke BAWAH ikon. Penyebabnya bukan kelasnya, tapi
 * TEMPATNYA — lihat komentar <CountAction> di bawah. Bar aksi di halaman
 * detail (`app/showcase/[id].tsx`) memakai koreksi yang sama.
 */

import { useCallback, useState } from "react"
import { BookmarkSimple, ChatCircle, Export, Flag, Heart, HeartStraight } from "phosphor-react-native"
import { router } from "expo-router"
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native"

import { formatCountCompact, formatDateTime, formatNumber } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"

import { Avatar } from "@/components/ui/avatar"
import { Divider } from "@/components/ui/divider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PageIndicator } from "@/components/ui/page-indicator"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

export type ShowcaseFeedItemProps = {
  item: ShowcaseSocialItem
  onPress?: () => void
  href?: unknown
  onToggleLike?: () => void
  onOpenComments?: () => void
  onToggleSave?: () => void
  saved?: boolean
  onShare?: () => void
  onReport?: () => void
  divider?: boolean
  className?: string
}

/**
 * Satu aksi hitungan di bar bawah kartu: ikon + angka + label SEJAJAR.
 *
 * NON-OBVIOUS (revisi 2026-09-18): kelas baris HARUS dipasang pada `className`
 * — View ISI di dalam <PressableScale> — bukan hanya pada `containerClassName`.
 * PressableScale merender `<Pressable><Animated.View><View className>`:
 * `containerClassName` hanya membentuk hit area, sedangkan anaknya dibungkus
 * dua View tanpa style. Kalau `flex-row items-center gap-*` diletakkan di hit
 * area, isinya tetap kolom default RN dan angka jatuh ke BAWAH ikon (bug yang
 * dilaporkan di list Showcase). Karena itu kelas baris ada di `className` dan
 * pemisah sumbu (min-h/px/focus ring) tetap di `containerClassName`.
 */
function CountAction({
  icon,
  iconWeight = "regular",
  count,
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  icon: IconComponent
  iconWeight?: "fill" | "regular"
  count: number
  label: string
  accessibilityLabel: string
  accessibilityHint: string
  onPress?: () => void
}) {
  const content = (
    <>
      <Icon icon={icon} size="md" tone="active" weight={iconWeight} />
      <Text variant="caption" weight={600} className="tabular-nums">
        {formatCountCompact(count)}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </>
  )

  if (!onPress) {
    return <View className="min-h-11 flex-row items-center gap-1.5 px-3">{content}</View>
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      haptic
      onPress={onPress}
      containerClassName={cn("min-h-11 flex-row items-center rounded-md px-3", focusRing)}
      className="flex-row items-center gap-1.5"
    >
      {content}
    </PressableScale>
  )
}

export function ShowcaseFeedItem({
  item,
  onPress,
  href,
  onToggleLike,
  onOpenComments,
  onToggleSave,
  saved = false,
  onShare,
  onReport,
  divider = false,
  className,
}: ShowcaseFeedItemProps) {
  void href
  const gallery = item.images.flatMap((image) => {
    const url = resolveMediaUrl(image.imageUrl)
    return url ? [{ id: image.id, url }] : []
  })
  const coverFallback = !gallery.length ? resolveMediaUrl(item.coverImageUrl ?? item.imageUrl) : undefined
  const priceLabel =
    item.priceMin != null && item.priceMax != null && item.priceMin !== item.priceMax
      ? `Rp ${formatNumber(item.priceMin)} – ${formatNumber(item.priceMax)}`
      : item.priceMin != null
        ? `Rp ${formatNumber(item.priceMin)}`
        : "Harga lewat diskusi"

  const liked = item.isLiked === true
  const likeCountLabel = `${formatCountCompact(item.likeCount)} Suka`
  const commentCountLabel = `${formatCountCompact(item.commentCount)} Komentar`
  const summary = `Showcase ${item.title}, ${priceLabel}, oleh ${item.author.fullName ?? item.author.username}`

  const [mediaPage, setMediaPage] = useState(0)
  const [cardWidth, setCardWidth] = useState(0)
  const { width: windowWidth } = useWindowDimensions()
  const pageWidth = cardWidth > 0 ? cardWidth : Math.max(0, windowWidth - 40)

  const handlePagerMomentum = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const w = cardWidth || windowWidth - 40
      if (w > 0) setMediaPage(Math.max(0, Math.round(event.nativeEvent.contentOffset.x / w)))
    },
    [cardWidth, windowWidth],
  )

  const handleReport = useCallback(() => {
    if (onReport) onReport()
    else router.push(ROUTES.reports({ targetId: item.id }))
  }, [onReport, item.id])

  const likeRow = (
    <CountAction
      icon={liked ? Heart : HeartStraight}
      iconWeight={liked ? "fill" : "regular"}
      count={item.likeCount}
      label="Suka"
      accessibilityLabel={liked ? "Hapus suka" : "Sukai"}
      accessibilityHint={likeCountLabel}
      onPress={onToggleLike}
    />
  )

  const commentRow = (
    <CountAction
      icon={ChatCircle}
      count={item.commentCount}
      label="Komentar"
      accessibilityLabel="Komentar"
      accessibilityHint={commentCountLabel}
      onPress={onOpenComments}
    />
  )

  return (
    <View className={cn("w-full", className)}>
      {/* ── Penulis + laporkan ── */}
      <View className="flex-row items-center gap-2 px-5 pt-3">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Lihat profil ${item.author.fullName ?? item.author.username}`}
          accessibilityHint={`@${item.author.username}`}
          onPress={() => router.push(ROUTES.userProfile(item.author.username))}
          containerClassName={cn("flex-1 flex-row items-center gap-3 rounded-md", focusRing)}
          className="flex-1 flex-row items-center gap-3"
        >
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
        </PressableScale>
        <IconButton
          icon={Flag}
          variant="ghost"
          size="sm"
          accessibilityLabel="Laporkan showcase"
          accessibilityHint="Laporkan showcase ini"
          onPress={handleReport}
        />
      </View>

      {/* ── Media CARD (mx-5) swipe ── */}
      <View className="mx-5 pt-3" onLayout={(e: any) => setCardWidth(e.nativeEvent.layout.width)}>
        {gallery.length === 0 && coverFallback ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={summary}
            accessibilityHint="Buka detail showcase"
            onPress={onPress}
            containerClassName={cn("w-full overflow-hidden rounded-sm", focusRing)}
            className="w-full"
          >
            {/* preventDownload (<Picture>) sudah memblok context-menu/save-as —
                membungkusnya lagi dengan View onContextMenu hanya menambah
                elemen dan menabrak tipe RN. */}
            <Picture source={coverFallback} alt={item.title} aspectRatio={1} radius="sm" bordered={false} preventDownload />
          </PressableScale>
        ) : gallery.length === 1 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={summary}
            accessibilityHint="Buka detail showcase"
            onPress={onPress}
            containerClassName={cn("w-full overflow-hidden rounded-sm", focusRing)}
            className="w-full"
          >
            <Picture
              source={gallery[0].url}
              alt={item.title}
              aspectRatio={1}
              radius="sm"
              bordered={false}
              recyclingKey={gallery[0].id}
              preventDownload
            />
          </PressableScale>
        ) : gallery.length > 1 ? (
          <View className="overflow-hidden rounded-sm border border-border">
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePagerMomentum}
            >
              {gallery.map((image: { id: string; url: string }, index: number) => (
                <View key={image.id} style={{ width: pageWidth }}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`${summary} — foto ${index + 1} dari ${gallery.length}`}
                    onPress={onPress}
                    containerClassName="w-full"
                  >
                    <Picture
                      source={image.url}
                      alt={item.title}
                      aspectRatio={1}
                      radius="none"
                      bordered={false}
                      recyclingKey={image.id}
                      preventDownload
                    />
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
            <View className="items-center bg-background py-2">
              <PageIndicator count={gallery.length} index={mediaPage} />
            </View>
          </View>
        ) : (
          <View className="h-64 items-center justify-center rounded-sm border border-border bg-surface">
            <Text variant="caption" tone="secondary">
              Tidak ada gambar
            </Text>
          </View>
        )}
      </View>

      {/* ── Harga · judul · deskripsi (tap ke detail) ── */}
      <PressableScale
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? summary : undefined}
        accessibilityHint={onPress ? "Buka detail showcase" : undefined}
        onPress={onPress}
        containerClassName={cn("w-full", focusRing)}
      >
        <View className="gap-1 px-5 pt-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="bodyLarge" weight={600} className="tabular-nums">
              {priceLabel}
            </Text>
            {item.category ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
          </View>
          <Text variant="body" weight={600} numberOfLines={2}>
            {item.title}
          </Text>
          {item.description ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </PressableScale>

      {/* ── Separator atas aksi (inset, bukan full) ── */}
      <Divider inset className="mt-3" />

      {/* ── Aksi: suka · komentar (kiri) · share · simpan (kanan) — count di samping ikon ── */}
      <View className="flex-row items-center px-2 pt-1">
        {likeRow}
        {commentRow}
        <View className="flex-1" />
        {onShare ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Bagikan"
            accessibilityHint="Bagikan showcase ini"
            onPress={onShare}
            containerClassName={cn("min-h-11 min-w-11 items-center justify-center rounded-md", focusRing)}
          >
            <Icon icon={Export} size="md" tone="active" />
          </PressableScale>
        ) : null}
        {onToggleSave ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={saved ? "Hapus dari tersimpan" : "Simpan"}
            accessibilityState={{ selected: saved }}
            onPress={onToggleSave}
            containerClassName={cn("min-h-11 min-w-11 items-center justify-center rounded-md", focusRing)}
          >
            <Icon icon={BookmarkSimple} size="md" tone="active" weight={saved ? "fill" : "regular"} />
          </PressableScale>
        ) : null}
      </View>

      {divider ? <Divider inset className="mt-1" /> : null}
    </View>
  )
}
