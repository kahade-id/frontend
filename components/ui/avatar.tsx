/**
 * Kahade — <Avatar> + <AvatarGroup> (§9.8).
 *
 * Lingkaran `rounded-full` (§5 radius.full) berisi foto, atau fallback
 * inisial nama di atas `bg-surface` + border default. Tidak ada warna
 * random per user — monokrom, sesuai brand.
 *
 * Ukuran: xs=24, sm=32, md=40 (default), lg=56, xl=80. Teks inisial
 * mengikuti ukuran (caption / label / body / h3 / h2).
 *
 * Keputusan non-obvious:
 *   - Inisial dihitung lewat `initials()` di lib/format.ts agar konsisten
 *     dengan komponen lain (mis. pihak transaksi di TransactionCard).
 *   - `verified` menempelkan ikon SealCheck fill `primary` di kanan bawah,
 *     dengan ring `border-background` supaya terpisah dari foto — indikator
 *     KYC selesai, penting untuk trust antar pihak escrow.
 *   - Gagal load gambar (`onError`) jatuh ke inisial, bukan kotak kosong.
 *   - Memakai expo-image, bukan RN <Image> (audit performa). Avatar adalah
 *     gambar remote yang PALING sering berulang di app ini: daftar pengikut,
 *     hasil pencarian, kartu pesanan, daftar chat, ulasan — orang yang sama
 *     muncul lagi dan lagi di layar berbeda. RN Image tidak punya disk cache
 *     yang bisa diatur dan men-decode di main thread, jadi setiap kemunculan
 *     ulang berarti unduh + decode ulang tepat saat pengguna sedang men-scroll.
 *     `cachePolicy="memory-disk"` membuat wajah yang sudah pernah dilihat
 *     muncul instan. `recyclingKey` wajib di daftar: tanpa itu sel FlatList
 *     yang dipakai ulang sempat menampilkan foto orang sebelumnya.
 *     `transition={0}` menjaga tampilannya tetap sama seperti sebelumnya —
 *     perubahan ini soal biaya, bukan soal animasi baru.
 *   - AvatarGroup menumpuk dengan overlap −8px (space.2) dan ring
 *     border-background 2px agar tiap lingkaran terpisah tanpa shadow.
 */
import { Image, type ImageSource } from "expo-image"
import { SealCheck, User } from "phosphor-react-native"
import { useEffect, useMemo, useState } from "react"
import { View, type ImageSourcePropType, type ViewProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Text, type TextVariant } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { initials as toInitials } from "@/lib/format"

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

export type AvatarProps = Omit<ViewProps, "children"> & {
  /** URL atau require() gambar */
  source?: ImageSourcePropType | string
  /** Nama untuk inisial fallback + accessibilityLabel */
  name?: string
  size?: AvatarSize
  /** Badge SealCheck KYC terverifikasi */
  verified?: boolean
  className?: string
}

const sizeBox: Record<AvatarSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
}

const sizeText: Record<AvatarSize, TextVariant> = {
  xs: "caption",
  sm: "label",
  md: "body",
  lg: "h3",
  xl: "h2",
}

const sizeIcon: Record<AvatarSize, number> = { xs: 12, sm: 16, md: 20, lg: 28, xl: 40 }
const sealSize: Record<AvatarSize, number> = { xs: 10, sm: 12, md: 16, lg: 20, xl: 24 }

/** expo-image tidak di-interop NativeWind; ukuran lewat style konstan. */
const FILL = { width: "100%", height: "100%" } as const

export function Avatar({
  source,
  name,
  size = "md",
  verified = false,
  className,
  ...rest
}: AvatarProps) {
  const [failed, setFailed] = useState(false)

  /*
   * `sourceKey` dulu dihitung dengan JSON.stringify(src) di badan render —
   * artinya serialisasi objek untuk SETIAP avatar pada SETIAP render, di
   * daftar yang justru sedang di-scroll. Sumber avatar praktis selalu berupa
   * URL string atau hasil require(), jadi kuncinya bisa diambil langsung.
   */
  const src = useMemo<ImageSource | number | undefined>(() => {
    if (source == null) return undefined
    if (typeof source === "string") return { uri: source }
    if (typeof source === "number") return source
    if (Array.isArray(source)) return source[0] as ImageSource
    return source as ImageSource
  }, [source])

  const sourceKey =
    typeof source === "string"
      ? source
      : typeof source === "number"
        ? String(source)
        : ((src as ImageSource | undefined)?.uri ?? "")

  useEffect(() => setFailed(false), [sourceKey])
  const showImage = !!src && !failed
  const label = name ? toInitials(name) : ""

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ? `Foto profil ${name}` : "Foto profil"}
      accessibilityHint={verified ? "Akun terverifikasi" : undefined}
      className={cn("relative", sizeBox[size], className)}
      {...rest}
    >
      <View
        className={cn(
          "h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-surface",
        )}
      >
        {showImage ? (
          <Image
            source={src}
            onError={() => setFailed(true)}
            style={FILL}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={sourceKey || undefined}
            transition={0}
            accessibilityIgnoresInvertColors
          />
        ) : label ? (
          <Text variant={sizeText[size]} weight={600} tone="secondary">
            {label}
          </Text>
        ) : (
          <Icon icon={User} size={sizeIcon[size]} />
        )}
      </View>

      {verified ? (
        <View className="absolute -bottom-[2px] -right-[2px] rounded-full border-[2px] border-background bg-background">
          <Icon icon={SealCheck} size={sealSize[size]} weight="fill" tone="active" />
        </View>
      ) : null}
    </View>
  )
}

// ------------------------------------------------------------------

export type AvatarGroupProps = ViewProps & {
  items: Array<Pick<AvatarProps, "source" | "name">>
  size?: AvatarSize
  /** Maksimum yang ditampilkan; sisanya jadi "+N" */
  max?: number
  className?: string
}

export function AvatarGroup({ items, size = "sm", max = 3, className, ...rest }: AvatarGroupProps) {
  const shown = items.slice(0, max)
  const rest_ = items.length - shown.length

  return (
    <View className={cn("flex-row items-center", className)} {...rest}>
      {shown.map((it, i) => (
        <View
          key={i}
          className={cn("rounded-full border-[2px] border-background", i > 0 && "-ml-2")}
        >
          <Avatar source={it.source} name={it.name} size={size} />
        </View>
      ))}
      {rest_ > 0 ? (
        <View
          className={cn(
            "-ml-2 items-center justify-center rounded-full border-[2px] border-background",
          )}
        >
          <View
            className={cn(
              "items-center justify-center rounded-full border border-border bg-surface",
              sizeBox[size],
            )}
          >
            <Text variant={sizeText[size]} weight={600} tone="secondary">
              {`+${rest_}`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
