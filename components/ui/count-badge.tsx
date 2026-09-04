/**
 * Kahade — <CountBadge> + <BadgedIcon> (pelengkap §9.7 Badge & §9.14 dot).
 *
 * §9.14 menetapkan Bottom Tab Bar memakai DOT merah tanpa angka. Tapi ada
 * tempat yang memang butuh angka: ikon bel di header ("3 belum dibaca"),
 * tab pesan di sub-header, jumlah item filter aktif. <Badge> (§9.7) adalah
 * label status berteks, radius xs — bentuknya tidak cocok untuk angka kecil
 * di sudut ikon. Karena itu dipisah: CountBadge = pill angka minimal.
 *
 * Aturan:
 *   - `count <= 0` -> tidak dirender (kecuali `showZero`), supaya pemanggil
 *     tidak perlu `count > 0 && <CountBadge/>` di mana-mana.
 *   - `max` (default 99) -> "99+". Angka tidak pernah lebih dari 3 karakter.
 *   - Tinggi 18px = lineHeight caption (12/18), `min-w-[18px]` agar satu
 *     digit tetap bulat sempurna (`rounded-full`), px-1 untuk 2-3 digit.
 *   - Teks caption weight 600 (bukan Mono: angka kecil di UI, bukan data
 *     presisi §3.1).
 *
 * Tone:
 *   - "danger" (default): merah solid — "ada yang baru/butuh perhatian",
 *     konsisten dengan NotificationDot. Teks putih di light, gray.950 di
 *     dark (fill dark terlalu terang untuk putih) — pola Button destructive.
 *   - "inverted": bg-primary/primary-foreground — jumlah netral yang tetap
 *     menonjol (item filter aktif, jumlah terpilih).
 *   - "neutral" : bg-surface + border — jumlah informatif (total item tab).
 *
 * <BadgedIcon> menempelkan CountBadge atau NotificationDot di sudut kanan
 * atas anak (biasanya <Icon>). Badge dibiarkan sedikit keluar dari kotak
 * ikon (-top/-right) agar tidak menutupi glyph.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { NotificationDot } from "@/components/ui/badge"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type CountBadgeTone = "danger" | "inverted" | "neutral"

export type CountBadgeProps = Omit<ViewProps, "children"> & {
  count: number
  /** Di atas ini tampil "N+" (default 99) */
  max?: number
  tone?: CountBadgeTone
  showZero?: boolean
  /** Dibaca screen reader; default angka apa adanya */
  accessibilityLabel?: string
  className?: string
}

const toneBox: Record<CountBadgeTone, string> = {
  danger: "bg-danger",
  inverted: "bg-primary",
  neutral: "bg-surface border border-border",
}

const toneText: Record<CountBadgeTone, string> = {
  danger: "text-white dark:text-gray-950",
  inverted: "text-primary-foreground",
  neutral: "text-text-secondary",
}

export function CountBadge({
  count,
  max = 99,
  tone = "danger",
  showZero = false,
  accessibilityLabel,
  className,
  ...rest
}: CountBadgeProps) {
  if (count <= 0 && !showZero) return null
  const shown = count > max ? `${max}+` : String(Math.max(0, Math.trunc(count)))

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? shown}
      className={cn(
        "h-[18px] min-w-[18px] items-center justify-center rounded-full px-1",
        toneBox[tone],
        className,
      )}
      {...rest}
    >
      <Text variant="caption" weight={600} tone="inherit" numberOfLines={1} className={toneText[tone]}>
        {shown}
      </Text>
    </View>
  )
}

export type BadgedIconProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Angka di sudut. Diabaikan bila `dot` true. */
  count?: number
  /** Dot merah tanpa angka (§9.14) */
  dot?: boolean
  max?: number
  tone?: CountBadgeTone
  className?: string
}

export function BadgedIcon({
  children,
  count = 0,
  dot = false,
  max,
  tone,
  className,
  ...rest
}: BadgedIconProps) {
  return (
    <View className={cn("relative self-start", className)} {...rest}>
      {children}
      {dot ? (
        <NotificationDot />
      ) : (
        <CountBadge count={count} max={max} tone={tone} className="absolute -right-2 -top-1" />
      )}
    </View>
  )
}
