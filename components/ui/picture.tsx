/**
 * Kahade — <Picture> (§5 radius, §6 border, §8 loading).
 *
 * Pembungkus RN <Image> dengan tiga perilaku yang harus seragam di app:
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
 * Keputusan non-obvious:
 *   - `alt` WAJIB di tipe: gambar KYC/bukti transfer bukan dekorasi. Untuk
 *     gambar murni dekoratif kirim `alt=""` (string kosong) -> disembunyikan
 *     dari screen reader (`accessibilityElementsHidden`).
 *   - Dimensi lewat `aspectRatio` (style runtime; tidak ada class Tailwind
 *     untuk rasio arbitrer) + lebar dari className (`w-full`). Pemanggil yang
 *     tahu ukuran pasti bisa kirim `width`/`height` px.
 *   - Border `bordered` default true: foto di atas background putih tanpa
 *     border kehilangan tepi di area terang (mis. struk putih) — §6 hierarki
 *     border.
 */
import { ImageBroken } from "phosphor-react-native"
import { useState } from "react"
import { Image, View, type ImageProps, type ImageSourcePropType, type ViewProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"

export type PictureRadius = "none" | "xs" | "sm" | "md"

export type PictureProps = Omit<ViewProps, "children"> & {
  source: ImageSourcePropType | string
  /** Teks alternatif. Kirim "" untuk gambar dekoratif. */
  alt: string
  /** Rasio lebar:tinggi, mis. 16/9, 1, 4/3. Diabaikan jika width+height diberikan. */
  aspectRatio?: number
  width?: number
  height?: number
  radius?: PictureRadius
  bordered?: boolean
  resizeMode?: ImageProps["resizeMode"]
  onLoad?: ImageProps["onLoad"]
  onError?: ImageProps["onError"]
  className?: string
}

const radiusClass: Record<PictureRadius, string> = {
  none: "rounded-none",
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
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
  className,
  style,
  ...rest
}: PictureProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")
  const src = typeof source === "string" ? { uri: source } : source
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
          resizeMode={resizeMode}
          className="h-full w-full"
          onLoad={(e) => {
            setStatus("loaded")
            onLoad?.(e)
          }}
          onError={(e) => {
            setStatus("error")
            onError?.(e)
          }}
          accessibilityIgnoresInvertColors
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
