/**
 * Kahade — <ShowcaseFeedItem> (§9.17, §9.23; revisi 2026-09-17).
 *
 * Satuan feed showcase bergaya POSTINGAN sosial (mockup docs/image/
 * IMG_20260917_224056_353.jpg) — BUKAN kartu: tanpa kotak border/background/
 * radius. Anatomi: media di atas (full-bleed — gutter dibawa pemanggil, lihat
 * ShowcaseFeedTab), lalu baris penulis (avatar + nama + username), judul
 * produk, harga, deskripsi singkat, dan baris aksi (suka · komentar · simpan ·
 * bagikan).
 *
 * Keputusan non-obvious:
 *   - AREA POSTINGAN dan BARIS AKSI adalah dua target tap yang TERPISAH.
 *     Sebelumnya seluruh item satu <PressableScale> dan statistik hanya teks;
 *     begitu like/komentar/simpan/bagikan hidup di feed, satu target tap
 *     mustahil — tombol di dalam tombol tidak terbaca screen reader dan tap
 *     pada ikon akan membuka detail. Jadi media+penulis+judul+deskripsi
 *     dibungkus tombol/tautan ke detail, sedangkan baris aksi punya tombol
 *     sendiri (pola <CardSummary> untuk kartu yang punya aksi).
 *   - `href` merender area postingan sebagai tautan sejati di web (<a> yang
 *     bisa ctrl/cmd-klik) — pola <Card href> / <ListItem href>.
 *   - Aksi bersifat OPSIONAL: tanpa `onToggleLike`/`onOpenComments`/
 *     `onToggleSave`/`onShare`, baris aksi tetap tampil sebagai statistik
 *     statis (perilaku lama) supaya komponen ini tetap bisa dipakai sebagai
 *     preview tanpa API.
 *   - Ikon aksi memakai tone "active" (tinta utama) meski kini berupa tombol:
 *     di atas postingan tanpa kartu, ikon abu tampak "mati" (keputusan visual
 *     yang sudah ada sebelumnya). STATE suka ditandai dengan hati terisi +
 *     angka ber-weight 600, bukan pergantian warna — merah sudah dicoret dari
 *     palet aksi sosial (docs/image/f739a1072b861fa6f9ae25e44ee7628e.jpg),
 *     dan layar detail memakai penanda yang sama supaya transisi list →
 *     detail tidak "berubah arti".
 *   - Grid media: 1 foto = kotak penuh 1:1; ≥2 foto = dua kolom 1:1 (gap
 *     2px), sisanya dihitung sebagai "+N" di atas scrim `bg-overlay-media`
 *     pada foto kedua — scrim 0.7 yang sama dengan <ShowcaseGalleryGrid>
 *     supaya label putih tetap ≥ 4.5:1 di atas foto terang.
 *   - Kolom grid memakai flex-1 (bukan w-1/2) agar gap terhitung otomatis;
 *     fraksi lebar + gap justru membuat kolom kedua wrap di RN.
 *   - `divider` menggambar garis pemisah di bawah postingan (1px, §6) —
 *     pemanggil mematikan divider pada item terakhir (tidak ada garis
 *     menggantung di ujung feed).
 */
import { BookmarkSimple, ChatCircle, Heart, HeartStraight, ShareNetwork } from "phosphor-react-native"
import { Link, type Href } from "expo-router"
import { View } from "react-native"

import { formatDateTime, formatNumber } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { resolveMediaUrl } from "@/lib/media"

import { Avatar } from "@/components/ui/avatar"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

export type ShowcaseFeedItemProps = {
  item: ShowcaseSocialItem
  /** Ketuk area postingan (media/penulis/judul) → detail */
  onPress?: () => void
  /** Tautan web (opsional) — bila dikirim, area postingan jadi <a href>. */
  href?: Href
  /** Suka/batal suka LANGSUNG dari feed (state di parent, lihat ShowcaseFeedTab) */
  onToggleLike?: () => void
  /** Ketuk komentar → BottomSheet daftar komentar */
  onOpenComments?: () => void
  /** Simpan/batal simpan (bookmark lokal — backend belum punya endpoint koleksi) */
  onToggleSave?: () => void
  /** Simpan aktif */
  saved?: boolean
  /** Bagikan item ini (share sheet native) */
  onShare?: () => void
  /** Garis pemisah di bawah item (matikan pada item terakhir) */
  divider?: boolean
  className?: string
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
  divider = false,
  className,
}: ShowcaseFeedItemProps) {
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
  const liked = item.isLiked === true
  const summary = `Showcase ${item.title}, ${priceLabel}, oleh ${item.author.fullName ?? item.author.username}`

  const post = (
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
    </View>
  )

  // Area postingan = satu target tap ke detail. Hanya ini yang jadi tombol;
  // baris aksi di bawahnya punya tombolnya sendiri (lihat catatan di atas).
  const interactivePost = onPress || href ? (
    <PressableScale
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={summary}
      accessibilityHint="Buka detail showcase"
      onPress={onPress}
      containerClassName={cn("w-full", focusRing)}
    >
      {post}
    </PressableScale>
  ) : (
    post
  )

  const likeRow = onToggleLike ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={liked ? "Hapus suka" : "Sukai"}
      accessibilityHint={`${formatNumber(item.likeCount)} suka`}
      haptic
      onPress={onToggleLike}
      containerClassName={cn("min-h-11 flex-row items-center gap-2 rounded-md px-3", focusRing)}
    >
      <Icon
        icon={liked ? Heart : HeartStraight}
        size="md"
        tone="active"
        weight={liked ? "fill" : "regular"}
      />
      <Text
        variant="caption"
        tone={liked ? "primary" : "secondary"}
        weight={liked ? 600 : 500}
        className="tabular-nums"
      >
        {formatNumber(item.likeCount)}
      </Text>
    </PressableScale>
  ) : (
    <View className="min-h-11 flex-row items-center gap-2 px-3">
      <Icon icon={HeartStraight} size="md" tone="active" />
      <Text variant="caption" tone="secondary" className="tabular-nums">
        {formatNumber(item.likeCount)}
      </Text>
    </View>
  )

  const commentRow = onOpenComments ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Komentar"
      accessibilityHint={`${formatNumber(item.commentCount)} komentar`}
      haptic
      onPress={onOpenComments}
      containerClassName={cn("min-h-11 flex-row items-center gap-2 rounded-md px-3", focusRing)}
    >
      <Icon icon={ChatCircle} size="md" tone="active" />
      <Text variant="caption" tone="secondary" className="tabular-nums">
        {formatNumber(item.commentCount)}
      </Text>
    </PressableScale>
  ) : (
    <View className="min-h-11 flex-row items-center gap-2 px-3">
      <Icon icon={ChatCircle} size="md" tone="active" />
      <Text variant="caption" tone="secondary" className="tabular-nums">
        {formatNumber(item.commentCount)}
      </Text>
    </View>
  )

  return (
    <View className="w-full">
      {href ? (
        <Link href={href} asChild>
          {interactivePost}
        </Link>
      ) : (
        interactivePost
      )}

      {/* ── Aksi: suka · komentar (kiri) · simpan · bagikan (kanan) ── */}
      <View className="flex-row items-center px-2 pt-1">
        {likeRow}
        {commentRow}
        <View className="flex-1" />
        {onToggleSave ? (
          <IconButton
            icon={BookmarkSimple}
            variant="ghost"
            size="sm"
            active={saved}
            accessibilityLabel={saved ? "Hapus dari tersimpan" : "Simpan"}
            onPress={onToggleSave}
          />
        ) : null}
        {onShare ? (
          <IconButton
            icon={ShareNetwork}
            variant="ghost"
            size="sm"
            accessibilityLabel="Bagikan"
            onPress={onShare}
          />
        ) : null}
      </View>

      {divider ? <Divider className="mt-5" /> : null}
    </View>
  )
}
