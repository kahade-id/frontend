/**
 * Kahade — <Text> wrapper (§3).
 *
 * SATU-SATUNYA jalan untuk merender teks di app. Jangan pakai <Text> RN
 * langsung. Alasan:
 *   1. `allowFontScaling={false}` — type scale FIXED (§3.2), tidak mengikuti
 *      Dynamic Type OS. Di-set sekali di sini, bukan disebar ke tiap pemakaian.
 *   2. Pemetaan variant -> class harus LITERAL (bukan template string) supaya
 *      Tailwind content scanner menemukannya. Karena itu ada tabel statis di
 *      bawah, bukan generate dari `typography` tokens saat runtime.
 *   3. Weight dipisah dari size: `text-h1` hanya size+lineHeight (lihat
 *      toTailwindTheme di tokens.ts), weight lewat `font-sans-700` yang
 *      menunjuk file font terdaftar. H1/H2 turun ke 600 di dark mode lewat
 *      `dark:font-sans-600` — sesuai §3.2, tanpa branch manual.
 *   4. `tabular-nums` di semua varian Sofia Sans (§3.1) agar angka rapi di
 *      list/tabel. Mono sudah monospaced, tidak perlu.
 *
 * Tone `inherit` dipakai saat warna diatur parent (mis. label di dalam
 * Button yang sudah punya text-primary-foreground).
 */
import { forwardRef } from "react"
import { Text as RNText, type TextProps as RNTextProps } from "react-native"

import { cn } from "@/lib/cn"
import type { TypographyKey } from "@/lib/tokens"

export type TextVariant = TypographyKey
/**
 * "inherit" = TIDAK memasang size/lineHeight/family sendiri — untuk Text yang
 * di-nest di dalam Text lain (mis. <Emphasis>) agar mewarisi ukuran parent.
 * RN menimpa style warisan dengan style anak, jadi anak harus benar-benar
 * kosong kecuali weight yang ingin diubah.
 */
export type TextVariantProp = TextVariant | "inherit"
export type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "disabled"
  | "inverse" // teks di atas bg-primary
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "inherit"

export type TextProps = RNTextProps & {
  variant?: TextVariantProp
  tone?: TextTone
  /** Paksa weight (mis. Caption 500 untuk penekanan ringan §3.2; emphasis inline §3.1) */
  weight?: 400 | 500 | 600 | 700
  className?: string
}

/** Size + lineHeight (+ letterSpacing mono) — weight & family di tabel terpisah */
const sizeClass: Record<TextVariant, string> = {
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  bodyLarge: "text-bodyLarge",
  body: "text-body",
  caption: "text-caption",
  label: "text-label",
  monoLarge: "text-monoLarge",
  monoBody: "text-monoBody",
}

/** Family+weight default per variant (dark-mode override untuk H1/H2) */
const faceClass: Record<TextVariant, string> = {
  display: "font-serif-500",
  h1: "font-sans-700 dark:font-sans-600 tabular-nums",
  h2: "font-sans-700 dark:font-sans-600 tabular-nums",
  h3: "font-sans-600 tabular-nums",
  bodyLarge: "font-sans-400 tabular-nums",
  body: "font-sans-400 tabular-nums",
  caption: "font-sans-400 tabular-nums",
  label: "font-sans-600 tabular-nums",
  monoLarge: "font-mono-600",
  monoBody: "font-mono-500",
}

/** Override weight eksplisit — hanya kombinasi yang ada file-nya di tokens */
const weightClass = {
  sans: { 400: "font-sans-400", 500: "font-sans-500", 600: "font-sans-600", 700: "font-sans-700" },
  serif: { 500: "font-serif-500" },
  mono: { 500: "font-mono-500", 600: "font-mono-600" },
} as const

const toneClass: Record<TextTone, string> = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  tertiary: "text-text-tertiary",
  disabled: "text-text-disabled",
  inverse: "text-primary-foreground",
  success: "text-success-text",
  danger: "text-danger-text",
  warning: "text-warning-text",
  info: "text-info-text",
  inherit: "",
}

function roleOf(variant: TextVariantProp): keyof typeof weightClass {
  if (variant === "display") return "serif"
  if (variant === "monoLarge" || variant === "monoBody") return "mono"
  // "inherit" dianggap sans: satu-satunya kasus nested-emphasis (§3.1)
  return "sans"
}

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", tone = "primary", weight, className, ...rest },
  ref,
) {
  const role = roleOf(variant)
  // Weight override hanya dipakai kalau file font-nya tersedia; kalau tidak,
  // pakai default variant (mis. serif hanya punya 500).
  const forced =
    weight != null
      ? (weightClass[role] as Partial<Record<number, string>>)[weight]
      : undefined

  // "inherit": jangan pasang size/face — hanya weight (jika ada) + tone.
  const inherit = variant === "inherit"

  return (
    <RNText
      ref={ref}
      allowFontScaling={false}
      className={cn(
        !inherit && sizeClass[variant],
        forced
          ? cn(forced, role === "sans" && "tabular-nums")
          : !inherit && faceClass[variant],
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  )
})
