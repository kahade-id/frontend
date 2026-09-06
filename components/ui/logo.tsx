/**
 * Kahade — <Logo> brand mark & wordmark (§1, §8 splash/pull-to-refresh, §16.5).
 *
 * Satu komponen untuk semua kemunculan logo: header beranda, layar loading
 * full-screen (§8), pull-to-refresh signature, onboarding, splash JS.
 *
 * Mark default = logo FINAL dari `assets/brand/logo-paths.ts` (path SVG yang
 * di-generate dari assets/brand/logo.svg, §16.5), dirender lewat
 * react-native-svg dan diwarnai dari token — bukan <Image> bitmap — supaya
 * ikut light/dark otomatis dan tajam di semua densitas. `source` tetap
 * tersedia untuk override bitmap (mis. varian berwarna khusus kampanye).
 * Wordmark tetap teks serif karena "Kahade" dalam EB Garamond adalah
 * keputusan tipografi §3.1 (editorial trust), bukan aset gambar.
 *
 * Keputusan non-obvious:
 *   - Ukuran mark: sm=24 (sejajar ikon md), md=40, lg=72 (= LOGO_SIZE splash).
 *     Nilai ini bukan token spacing, maka dipasang lewat `style`/prop ukuran
 *     (bukan className) sebagai "ukuran gambar", sama seperti Icon.
 *   - Warna path lewat `useTheme()` + tokens (pola yang sama dengan Icon):
 *     SVG `fill` bukan style yang bisa di-className. Tone default = `primary`
 *     (hitam di light, putih di dark — logo sebagai "otoritas" §1.1); tone
 *     "inverse" = `primaryForeground` untuk logo di atas bg-primary (hero
 *     saldo, card inverted §9.6).
 *   - `assets/brand/logo-paths.ts` sengaja tidak menyimpan warna; JANGAN
 *     menambahkan fill di sana.
 *   - Tidak pakai <Text accessibilityHint="Ketuk untuk detail"> RN langsung — tetap lewat wrapper (§3 fixed scale).
 */
import { Image, View, type ImageSourcePropType, type ViewProps } from "react-native"
import Svg, { G, Path } from "react-native-svg"

import { LOGO_PATHS, LOGO_VIEWBOX } from "@/assets/brand/logo-paths"
import { useTheme } from "@/components/theme-provider"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

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

/**
 * Mark saja, tanpa tema — `fill` wajib diberikan pemanggil.
 *
 * Ada karena <AnimatedSplash> dirender SEBAGAI SAUDARA <ThemeProvider>
 * (app/_layout.tsx: provider ditutup di baris 113, splash di 117), sedangkan
 * `useTheme()` sengaja melempar error di luar provider. Memakai <Logo> di sana
 * = crash saat boot. Memberi useTheme() nilai default hanya untuk kasus ini
 * akan melemahkan penjaga yang justru berguna di tempat lain.
 *
 * Jadi geometri tinggal di SATU tempat (LOGO_PATHS) dan dipakai dua lapis:
 *   <LogoMark>  primitif, butuh `fill` eksplisit dari token
 *   <Logo>      pembungkus ber-tema, memilih `fill` dari useTheme()
 * Pemakaian normal di dalam app SELALU lewat <Logo>.
 */
export function LogoMark({ size, fill }: { size: number; fill: string }) {
  const reducedMotion = useReducedMotion() // respect OS reduced motion (WCAG 2.3.3)
  return (
    <Svg width={size} height={size} viewBox={LOGO_VIEWBOX}>
      <G fill={fill}>
        {LOGO_PATHS.map((p, i) => (
          <Path key={i} d={p.d} transform={p.transform} />
        ))}
      </G>
    </Svg>
  )
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
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const fill = tone === "inverse" ? palette.primaryForeground : palette.primary
  const wordTone = tone === "inverse" ? "inverse" : "primary"

  const mark = source ? (
    <Image
      source={source}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      style={{ width: px, height: px }}
    />
  ) : (
    <LogoMark size={px} fill={fill} />
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
    <View accessible={false}
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