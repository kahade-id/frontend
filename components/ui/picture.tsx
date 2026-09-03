/**
 * Kahade — <Picture> (§5 radius, §6 border, §8 loading).
 *
 * Pembungkus expo-image <Image> dengan tiga perilaku yang harus seragam di app:
 *   1. Loading  : placeholder Skeleton (pulse) selama gambar belum ter-decode,
 *                 bukan area kosong yang "melompat" saat gambar muncul.
 *   2. Error    : fallback ikon ImageBroken text-tertiary di atas bg-surface
 *                 + border — bukan kotak putih polos.
 *   3. Radius   : dibatasi ke skala §5 (none/xs/sm/md). TIDAK ada radius lebih
 *                 besar — "8px maksimum non-pill termasuk large image" (§5).
 *
 * Dinamai <Picture>, bukan <Image>, agar tidak bertabrakan dengan import
 * `Image` dari react-native di file lain (Avatar memakai RN Image langsung
 * karena selalu lingkaran).
 *
 * Kenapa expo-image, bukan RN <Image> (non-obvious):
 *   Gambar di Kahade didominasi foto KYC, bukti transfer, dan struk — file
 *   besar yang dibuka berulang (detail transaksi <-> daftar). RN Image tidak
 *   punya disk cache yang bisa diatur dan decode di main thread. expo-image
 *   (SDWebImage/Glide) decode di background thread, `cachePolicy` default
 *   "memory-disk" membuat gambar yang sudah dilihat muncul instan saat
 *   kembali, dan `transition` fade singkat menggantikan "pop" saat Skeleton
 *   dilepas. Hemat bandwidth pengguna — relevan untuk foto bukti 2–5 MB.
 *
 * Keputusan non-obvious:
 *   - `alt` WAJIB di tipe: gambar KYC/bukti transfer bukan dekorasi. Untuk
 *     gambar murni dekoratif kirim `alt=""` (string kosong) -> disembunyikan
 *     dari screen reader (`accessibilityElementsHidden`).
 *   - `resizeMode` (kosakata RN) tetap dipertahankan sebagai prop publik dan
 *     dipetakan ke `contentFit` expo-image (`resizeModeToContentFit`) supaya
 *     pemanggil tidak perlu tahu perbedaan implementasi. "repeat" tidak
 *     punya padanan -> jatuh ke "cover".
 *   - `onLoad`/`onError` tetap ada, tetapi payload-nya adalah event
 *     expo-image (`ImageLoadEventData` berisi ukuran sumber, `ImageErrorEventData`
 *     berisi pesan) — lebih informatif dari event RN dan tidak perlu di-cast.
 *   - Dimensi lewat `aspectRatio` (style runtime; tidak ada class Tailwind
 *     untuk rasio arbitrer) + lebar dari className (`w-full`). Pemanggil yang
 *     tahu ukuran pasti bisa kirim `width`/`height` px.
 *   - Border `bordered` default true: foto di atas background putih tanpa
 *     border kehilangan tepi di area terang (mis. struk putih) — §6 hierarki
 *     border.
 *   - expo-image tidak di-interop NativeWind -> ukuran lewat style
 *     (`width/height: 100%`), className tetap di pembungkus View.
 *   - `recyclingKey` diteruskan untuk FlatList: memaksa expo-image membuang
 *     bitmap lama saat sel di-recycle, sehingga tidak ada foto "salah orang"
 *     sekejap di daftar.
 */
import { Image, type ImageProps as ExpoImageProps, type ImageSource } from "expo-image"
import { ImageBroken } from "phosphor-react-native"
import { useState } from "react"
import { View, type ImageResizeMode, type ViewProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type PictureRadius = "none" | "xs" | "sm" | "md"

export type PictureProps = Omit<ViewProps, "children"> & {
  /** URL string, `require()`, atau ImageSource expo-image */
  source: ImageSource | number | string
  /** Teks alternatif. Kirim "" untuk gambar dekoratif. */
  alt: string
  /** Rasio lebar:tinggi, mis. 16/9, 1, 4/3. Diabaikan jika width+height diberikan. */
  aspectRatio?: number
  width?: number
  height?: number
  radius?: PictureRadius
  bordered?: boolean
  /** Kosakata RN; dipetakan ke contentFit expo-image */
  resizeMode?: ImageResizeMode
  onLoad?: ExpoImageProps["onLoad"]
  onError?: ExpoImageProps["onError"]
  /** Default "memory-disk" — lihat header file */
  cachePolicy?: ExpoImageProps["cachePolicy"]
  /** Untuk sel FlatList yang di-recycle */
  recyclingKey?: string
  className?: string
}

const radiusClass: Record<PictureRadius, string> = {
  none: "rounded-none",
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
}

const resizeModeToContentFit: Record<ImageResizeMode, NonNullable<ExpoImageProps["contentFit"]>> = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "none",
  repeat: "cover",
  none: "none",
}

export function Picture({
  source,
  alt,
  aspectRatio,
  width,
  height,
  radius = "md",
  bordered = true,
  resizeMode = "cover",
  onLoad,
  onError,
  cachePolicy = "memory-disk",
  recyclingKey,
  className,
  style,
  ...rest
}: PictureProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")
  const src: ImageSource | number = typeof source === "string" ? { uri: source } : source
  const decorative = alt === ""

  const dimension =
    width != null && height != null
      ? { width, height }
      : { width, height, aspectRatio: aspectRatio ?? 4 / 3 }

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : alt}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      className={cn(
        "relative overflow-hidden bg-surface",
        radiusClass[radius],
        bordered && "border border-border",
        width == null && "w-full",
        className,
      )}
      style={[dimension, style]}
      {...rest}
    >
      {status !== "error" ? (
        <Image
          source={src}
          contentFit={resizeModeToContentFit[resizeMode]}
          contentPosition="center"
          cachePolicy={cachePolicy}
          recyclingKey={recyclingKey}
          transition={tokens.motion.duration.fast}
          style={{ width: "100%", height: "100%" }}
          onLoad={(e) => {
            setStatus("loaded")
            onLoad?.(e)
          }}
          onError={(e) => {
            setStatus("error")
            onError?.(e)
          }}
        />
      ) : null}

      {/* Overlay loading/error di atas area yang sama agar ukuran tidak berubah */}
      {status === "loading" ? (
        <View className="absolute inset-0">
          <Skeleton shape="rect" className="h-full w-full rounded-none" />
        </View>
      ) : null}

      {status === "error" ? (
        <View className="absolute inset-0 items-center justify-center">
          <Icon icon={ImageBroken} size="lg" accessibilityLabel="Gambar gagal dimuat" />
        </View>
      ) : null}
    </View>
  )
}
