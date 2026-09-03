/**
 * Kahade — <Icon> (§7, Phosphor).
 *
 * Wrapper tipis di atas `phosphor-react-native` yang menerapkan aturan §7:
 *   - size scale 16/20/24/28/32 (default md = 24) dari tokens.icon.size
 *   - weight default "regular"; aktif/selected "fill" (atau "bold" via prop)
 *   - warna default text-tertiary; aktif = text-primary
 *
 * Kenapa warna di-resolve lewat useTheme() dan BUKAN className (non-obvious):
 *   Ikon Phosphor adalah SVG dengan prop `color` — bukan style yang bisa
 *   di-className. Ini masuk pengecualian "hal yang tidak bisa di-className"
 *   (sama seperti `contentStyle` Stack di _layout.tsx). Nilainya tetap dari
 *   tokens, bukan hex hardcode, dan tetap reaktif terhadap mode karena
 *   useTheme() re-render saat mode berubah.
 *
 * Kenapa satu paket untuk semua platform (menyimpang dari §15 yang menyebut
 * `phosphor-react` untuk web): `phosphor-react-native` berjalan di web lewat
 * react-native-svg/react-native-web, sehingga satu import path, satu tipe
 * `IconComponent`, tanpa Platform.select di setiap pemakaian.
 *
 * Ikon di dalam input error TETAP text-tertiary (§7) — jangan kirim
 * tone="danger" dari komponen Input.
 */
import type { ComponentType } from "react"
import { View } from "react-native"
import type { IconProps as PhosphorProps, IconWeight } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"

export type IconComponent = ComponentType<PhosphorProps>
export type IconWeightProp = IconWeight
export type IconSize = keyof typeof tokens.icon.size
export type IconTone =
  | "default" // text-tertiary
  | "active" // text-primary
  | "inverse" // primary-foreground (di atas bg-primary)
  | "disabled"
  | "success"
  | "danger"
  | "warning"
  | "info"

export type IconProps = {
  icon: IconComponent
  /** Key skala (§7) atau angka px kalau memang perlu di luar skala */
  size?: IconSize | number
  tone?: IconTone
  /** Shortcut: active=true -> weight "fill" + tone "active" */
  active?: boolean
  weight?: IconWeight
  /** Override warna eksplisit (harus dari tokens, bukan hex literal) */
  color?: string
  accessibilityLabel?: string
  /** Style tambahan hanya untuk hal non-warna (mis. transform) */
  style?: PhosphorProps["style"]
}

export function useIconColor(tone: IconTone = "default"): string {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  switch (tone) {
    case "active":
      return palette.textPrimary
    case "inverse":
      return palette.primaryForeground
    case "disabled":
      return palette.textDisabled
    case "success":
    case "danger":
    case "warning":
    case "info":
      return tokens.colors.semantic[tone][mode].fill
    default:
      return palette.textTertiary
  }
}

export function Icon({
  icon: Glyph,
  size = "md",
  tone,
  active = false,
  weight,
  color,
  accessibilityLabel,
  style,
}: IconProps) {
  const resolvedTone: IconTone = tone ?? (active ? "active" : "default")
  const themed = useIconColor(resolvedTone)
  const px = typeof size === "number" ? size : tokens.icon.size[size]
  const w: IconWeight =
    weight ?? (active ? tokens.icon.weight.active : tokens.icon.weight.default)

  const glyph = <Glyph size={px} color={color ?? themed} weight={w} style={style} />

  // Phosphor IconProps TIDAK menerima prop accessibility RN (hanya color/size/
  // weight/style/mirrored). Ikon tanpa label = dekoratif -> render polos dan
  // tak terlihat screen reader (SVG tidak punya teks). Ikon berlabel dibungkus
  // <View accessible> agar label terbaca sebagai satu elemen "image".
  if (!accessibilityLabel) return glyph

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: px, height: px }}
    >
      {glyph}
    </View>
  )
}
