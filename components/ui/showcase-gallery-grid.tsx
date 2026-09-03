/**
 * Kahade — <ShowcaseGalleryGrid> (§5 radius, §6 border, §11 grid).
 *
 * Grid foto persegi untuk etalase penjual (showcase produk/jasa) di halaman
 * profil. 3 kolom default, gap 8px (space.2), tiap sel <Picture> rasio 1:1
 * radius `sm` (6px). Bukan `md`: sel kecil (~100px) dengan radius 8px
 * terlihat terlalu "bulat" berdampingan — sm menjaga kesan presisi (§1).
 *
 * Kenapa menghitung lebar sel dari `onLayout`, bukan class `w-1/3`
 * (non-obvious): alasan yang sama dengan <Grid> — fraksi Tailwind tidak
 * memperhitungkan gap, sel ketiga akan wrap. Lebar = (W - gap*(cols-1)) /
 * cols, dibulatkan ke bawah, lalu dipakai untuk width DAN height (persegi).
 * Nilai runtime -> style; sisanya className. Tidak memakai <Grid>/<GridItem>
 * 12 kolom karena galeri butuh rasio persegi eksplisit dan kolom tetap,
 * bukan span fleksibel.
 *
 * Keputusan non-obvious:
 *   - `max` memotong daftar; sel TERAKHIR yang tampil menjadi "+N" overlay
 *     bila masih ada sisa — pola yang sama dengan <AvatarGroup>. Overlay
 *     memakai `bg-overlay` (scrim yang selalu hitam di kedua mode, lihat
 *     tokens `overlay`) dengan teks `text-white`: satu-satunya pengecualian
 *     warna literal, karena teks berdiri di atas scrim hitam — bukan di atas
 *     primary yang invert. Preseden sama: Button destructive `text-white`.
 *   - Tap sel = `onPressItem(item, index)` — pemanggil membuka viewer/Push
 *     (§10: detail lengkap = Push). Pressed-scale 0.97 lewat PressableScale,
 *     sesuai Card interaktif.
 *   - Tiap foto WAJIB punya `alt` (tipe), diteruskan ke <Picture>; galeri
 *     etalase adalah konten, bukan dekorasi.
 *   - `bordered` Picture dimatikan: 9 border abu berdampingan menjadi
 *     jala visual yang bising; pemisahan sel sudah dibentuk gap + background.
 *   - Loading: `loadingCount` sel Skeleton `card` persegi dengan lebar sama
 *     — dan grid tetap menunggu `onLayout` agar skeleton pun tidak melompat.
 *   - Kosong: slot `empty` (kirim <EmptyState>) — komponen tidak menebak
 *     copy karena beda konteks (profil sendiri vs orang lain).
 *   - `recyclingKey` = id item agar expo-image tidak menampilkan foto lama
 *     sekejap saat daftar berubah (lihat <Picture>).
 */
import { useState, type ReactNode } from "react"
import { View, type LayoutChangeEvent, type ViewProps } from "react-native"

import { Picture, type PictureProps } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { space } from "@/lib/tokens"

export type ShowcaseItem = {
  id: string
  source: PictureProps["source"]
  alt: string
}

export type ShowcaseGalleryGridProps = Omit<ViewProps, "children"> & {
  items: readonly ShowcaseItem[]
  onPressItem?: (item: ShowcaseItem, index: number) => void
  /** Kolom per baris (default 3) */
  columns?: 2 | 3 | 4
  /** Batas sel yang ditampilkan; sisanya "+N" di sel terakhir */
  max?: number
  loading?: boolean
  /** Jumlah sel skeleton saat loading (default = columns * 2) */
  loadingCount?: number
  /** Dirender saat items kosong dan tidak loading */
  empty?: ReactNode
  className?: string
}

/** Gap antar sel: space.2 (8px) — sama dengan gap internal komponen kecil */
const GAP = space[2]

export function ShowcaseGalleryGrid({
  items,
  onPressItem,
  columns = 3,
  max,
  loading = false,
  loadingCount,
  empty,
  className,
  ...rest
}: ShowcaseGalleryGridProps) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  const cell = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0
  const shown = max != null ? items.slice(0, max) : items
  const overflow = items.length - shown.length

  if (!loading && items.length === 0) {
    return (
      <View className={cn("w-full", className)} {...rest}>
        {empty}
      </View>
    )
  }

  return (
    <View
      onLayout={onLayout}
      accessibilityRole={loading ? "progressbar" : undefined}
      accessibilityLabel={loading ? "Memuat etalase" : undefined}
      className={cn("w-full flex-row flex-wrap gap-2", className)}
      {...rest}
    >
      {cell > 0
        ? loading
          ? Array.from({ length: loadingCount ?? columns * 2 }, (_, i) => (
              <Skeleton key={i} shape="card" width={cell} height={cell} className="rounded-sm" />
            ))
          : shown.map((item, index) => {
              const isLast = index === shown.length - 1
              const showMore = isLast && overflow > 0

              const picture = (
                <View style={{ width: cell, height: cell }} className="overflow-hidden rounded-sm">
                  <Picture
                    source={item.source}
                    alt={showMore ? `${item.alt}, ${formatNumber(overflow)} foto lainnya` : item.alt}
                    width={cell}
                    height={cell}
                    radius="sm"
                    bordered={false}
                    recyclingKey={item.id}
                  />
                  {showMore ? (
                    <View
                      pointerEvents="none"
                      className="absolute inset-0 items-center justify-center bg-overlay"
                    >
                      <Text variant="h3" tone="inherit" className="text-white">
                        {`+${formatNumber(overflow)}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )

              if (!onPressItem) return <View key={item.id}>{picture}</View>

              return (
                <PressableScale
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.alt}
                  accessibilityHint={showMore ? "Buka semua foto" : "Buka foto"}
                  onPress={() => onPressItem(item, index)}
                >
                  {picture}
                </PressableScale>
              )
            })
        : null}
    </View>
  )
}
