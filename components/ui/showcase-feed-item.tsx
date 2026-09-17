/**
 * Kahade — <ShowcaseFeedItem> (§9.17, §9.23; revisi 2026-09-17 #2).
 *
 * Satuan feed showcase bergaya POSTINGAN sosial (mockup docs/image/
 * IMG_20260917_224056_353.jpg) — BUKAN kartu: tanpa kotak border/background/
 * radius. Anatomi revisi #2 mengikuti urutan yang diminta produk: baris
 * penulis DI ATAS (avatar + nama + @username + tanggal unggah), lalu media
 * full-bleed, lalu harga (nominal diperbesar: bodyLarge 600, bukan caption),
 * judul, deskripsi, dan baris aksi.
 *
 * Baris aksi (mockup): [hati + hitungan + "Suka"] [balon + hitungan +
 * "Komentar"] di kiri; [share ikon Export] [bookmark] di kanan — hitungan
 * SEKOLAH teksnya (bukan di bawah ikon), dan hitungan besar diringkas
 * "1,4K / 2M" (formatCountCompact). Keempat ikon SATU ukuran (md) supaya
 * baris selaras; share memakai ikon "export" sesuai permintaan produk.
 *
 * Keputusan non-obvious (dipertahankan dari revisi sebelumnya):
 *   - AREA POSTINGAN dan BARIS AKSI adalah dua target tap yang TERPISAH —
 *     tombol di dalam tombol tidak terbaca screen reader dan tap pada ikon
 *     akan membuka detail. Media+penulis+harga+judul+deskripsi dibungkus
 *     tombol/tautan ke detail; baris aksi punya tombol sendiri.
 *   - `href` merender area postingan sebagai tautan sejati di web.
 *   - Aksi bersifat OPSIONAL: tanpa callback, baris aksi tampil sebagai
 *     statistik statis supaya komponen tetap bisa dipakai sebagai preview.
 *   - Grid media: 1 foto = kotak penuh 1:1; ≥2 foto = dua kolom 1:1 (gap
 *     2px), sisanya "+N" di atas scrim `bg-overlay-media` 0.7.
 *   - `divider` menggambar garis pemisah di bawah postingan; pemanggil
 *     mematikannya pada item terakhir.
 */
import { BookmarkSimple, ChatCircle, Export, Heart, HeartStraight } from "phosphor-react-native"
import { Link, type Href } from "expo-router"
import { View } from "react-native"

import { formatCountCompact, formatDateTime, formatNumber } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { resolveMediaUrl } from "@/lib/media"

import { Avatar } from "@/components/ui/avatar"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
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
  /** Ketuk komentar → BottomSheet daftar komentar + komposer */
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
  const likeCountLabel = `${formatCountCompact(item.likeCount)} Suka`
  const commentCountLabel = `${formatCountCompact(item.commentCount)} Komentar`

  const post = (
    <View className={cn(className)}>
      {/* ── Penulis (di atas media) ── */}
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

      {/* ── Media ── */}
      <View className="pt-3">
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
      </View>

      {/* ── Harga · judul · deskripsi ── */}
      <View className="gap-1 px-5 pt-3">
        <View className="flex-row flex-wrap items-center gap-2">
          {/* Nominal diperbesar satu tingkat (caption → bodyLarge) supaya
              harga terbaca sebagai informasi utama postingan. */}
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
      accessibilityHint={likeCountLabel}
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
      <Text variant="caption" weight={600} className="tabular-nums">
        {formatCountCompact(item.likeCount)}
      </Text>
      <Text variant="caption" tone="secondary">
        Suka
      </Text>
    </PressableScale>
  ) : (
    <View className="min-h-11 flex-row items-center gap-2 px-3">
      <Icon icon={HeartStraight} size="md" tone="active" />
      <Text variant="caption" weight={600} className="tabular-nums">
        {formatCountCompact(item.likeCount)}
      </Text>
      <Text variant="caption" tone="secondary">
        Suka
      </Text>
    </View>
  )

  const commentRow = onOpenComments ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Komentar"
      accessibilityHint={commentCountLabel}
      haptic
      onPress={onOpenComments}
      containerClassName={cn("min-h-11 flex-row items-center gap-2 rounded-md px-3", focusRing)}
    >
      <Icon icon={ChatCircle} size="md" tone="active" />
      <Text variant="caption" weight={600} className="tabular-nums">
        {formatCountCompact(item.commentCount)}
      </Text>
      <Text variant="caption" tone="secondary">
        Komentar
      </Text>
    </PressableScale>
  ) : (
    <View className="min-h-11 flex-row items-center gap-2 px-3">
      <Icon icon={ChatCircle} size="md" tone="active" />
      <Text variant="caption" weight={600} className="tabular-nums">
        {formatCountCompact(item.commentCount)}
      </Text>
      <Text variant="caption" tone="secondary">
        Komentar
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

      {/* ── Aksi: suka · komentar (kiri) · share(export) · simpan (kanan).
           Keempat ikon size md supaya baris selaras. ── */}
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

      {divider ? <Divider className="mt-5" /> : null}
    </View>
  )
}
