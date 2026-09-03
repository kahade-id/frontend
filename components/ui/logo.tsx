/**
 * Kahade — <Logo> brand mark & wordmark (§1, §8 splash/pull-to-refresh, §16.5).
 *
 * Satu komponen untuk semua kemunculan logo: header beranda, layar loading
 * full-screen (§8), pull-to-refresh signature, onboarding, splash JS.
 *
 * Status aset (jujur): logo final "sudah ada tapi belum dilampirkan" (§16.5).
 * Sampai file itu masuk, `Logo` merender MARK PLACEHOLDER: kotak radius.md
 * ber-border dengan huruf "K" EB Garamond — konsisten dengan placeholder di
 * animated-splash.tsx. Begitu aset tersedia, kirim `source` (PNG/SVG via
 * require) dan mark otomatis diganti <Image>; wordmark tetap teks serif
 * karena "Kahade" dalam EB Garamond adalah keputusan tipografi §3.1
 * (editorial trust), bukan aset gambar.
 *
 * Keputusan non-obvious:
 *   - Ukuran mark: sm=24 (sejajar ikon md), md=40, lg=72 (= LOGO_SIZE splash).
 *     Nilai ini bukan token spacing, maka dipasang lewat `style` (bukan
 *     className) sebagai "ukuran gambar", sama seperti Icon.
 *   - fontSize huruf placeholder = 55% ukuran mark — proporsi, bukan konstanta
 *     baru; ikut `style` karena tidak ada di type scale.
 *   - Tone "inverse" untuk logo di atas bg-primary (hero saldo, card
 *     inverted §9.6): mark jadi outline primary-foreground, tanpa fill.
 *   - Tidak pakai <Text> RN langsung — tetap lewat wrapper (§3 fixed scale).
 */
import { Image, View, type ImageSourcePropType, type ViewProps } from "react-native"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type LogoSize = "sm" | "md" | "lg"
export type LogoVariant = "mark" | "wordmark" | "lockup"
export type LogoTone = "default" | "inverse"

export type LogoProps = Omit<ViewProps, "children"> & {
  variant?: LogoVariant
  size?: LogoSize
  tone?: LogoTone
  /** Aset mark final (require("…/logo-kahade.png")). Kosong = placeholder. */
  source?: ImageSourcePropType
  className?: string
}

const markPx: Record<LogoSize, number> = { sm: 24, md: 40, lg: 72 }
/** Ukuran huruf wordmark mengikuti tinggi mark agar lockup sejajar */
const wordPx: Record<LogoSize, number> = { sm: 18, md: 28, lg: 44 }

const markBox: Record<LogoTone, string> = {
  default: "bg-primary border border-primary",
  inverse: "bg-transparent border border-primary-foreground",
}

export function Logo({
  variant = "mark",
  size = "md",
  tone = "default",
  source,
  className,
  ...rest
}: LogoProps) {
  const px = markPx[size]
  // Huruf placeholder: di tone default duduk di atas fill primary -> inverse;
  // di tone inverse mark hanya outline primary-foreground -> huruf ikut inverse.
  // Keduanya "inverse" secara kebetulan, tetapi alasannya berbeda (lihat atas).
  const letterTone = "inverse" as const
  const wordTone = tone === "inverse" ? "inverse" : "primary"

  const mark = source ? (
    <Image
      source={source}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      style={{ width: px, height: px }}
    />
  ) : (
    <View
      className={cn("items-center justify-center rounded-md", markBox[tone])}
      style={{ width: px, height: px }}
    >
      <Text
        variant="inherit"
        tone={letterTone}
        className="font-serif-500"
        // Proporsi terhadap mark, bukan konstanta type scale
        style={{ fontSize: px * 0.55, lineHeight: px * 0.7 }}
      >
        K
      </Text>
    </View>
  )

  const word = (
    <Text
      variant="inherit"
      tone={wordTone}
      className="font-serif-500"
      style={{ fontSize: wordPx[size], lineHeight: wordPx[size] * 1.15 }}
    >
      Kahade
    </Text>
  )

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Kahade"
      className={cn("flex-row items-center", variant === "lockup" && "gap-3", className)}
      {...rest}
    >
      {variant !== "wordmark" ? mark : null}
      {variant !== "mark" ? word : null}
    </View>
  )
}
