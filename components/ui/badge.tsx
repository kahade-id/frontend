/**
 * Kahade — <Badge> (§9.7).
 *
 * Label status kecil, radius `xs` (4px), tinggi 22px (caption 18 + py 2).
 * Dua gaya:
 *   - "soft"    (default): fill bgSoft + teks semantic text — untuk status
 *                transaksi di list/detail (Success/Danger/Warning/Info).
 *   - "outline" : transparan + border-default + text-secondary — untuk
 *                kategori netral (jenis barang, metode) yang bukan status.
 * Tone "neutral" (soft) = bg-surface + text-secondary untuk badge non-semantik
 * yang tetap ingin fill.
 *
 * Keputusan non-obvious:
 *   - Teks variant `caption` weight 500 — bukan label 600 — karena badge
 *     bukan judul; 500 cukup membedakan dari body tanpa terasa "berteriak".
 *     Tidak ALL CAPS (§3.2).
 *   - `dot` menaruh titik 6px warna fill di kiri teks; alternatif untuk
 *     badge di ruang sempit (mis. header list) tanpa fill lebar.
 *   - Semantic color eksklusif untuk STATUS transaksi (§2.3). Jangan pakai
 *     tone success/danger untuk kategori non-status — pakai "neutral"/outline.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info"
export type BadgeVariant = "soft" | "outline"

export type BadgeProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  tone?: BadgeTone
  variant?: BadgeVariant
  /** Titik 6px warna fill di kiri teks */
  dot?: boolean
  icon?: IconComponent
  className?: string
}

const softBox: Record<BadgeTone, string> = {
  neutral: "bg-surface border border-border",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
}

const textTone: Record<BadgeTone, TextTone> = {
  neutral: "secondary",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

const dotClass: Record<BadgeTone, string> = {
  neutral: "bg-text-tertiary",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
}

const iconTone: Record<BadgeTone, IconTone> = {
  neutral: "default",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

export function Badge({
  children,
  tone = "neutral",
  variant = "soft",
  dot = false,
  icon,
  className,
  ...rest
}: BadgeProps) {
  return (
    <View
      className={cn(
        "self-start flex-row items-center gap-1 rounded-xs px-2 py-[2px]",
        variant === "soft" ? softBox[tone] : "bg-transparent border border-border",
        className,
      )}
      {...rest}
    >
      {dot ? <View className={cn("h-[6px] w-[6px] rounded-full", dotClass[tone])} /> : null}
      {icon ? <Icon icon={icon} size={12} tone={iconTone[tone]} weight="bold" /> : null}
      <Text ellipsizeMode="tail" accessibilityHint="Ketuk untuk detail"
        variant="caption"
        weight={500}
        tone={variant === "outline" ? "secondary" : textTone[tone]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  )
}

/**
 * <NotificationDot> — titik merah solid 8px tanpa angka (§9.14), untuk
 * "ada yang baru" di ikon tab / avatar. Posisi absolute top-right; parent
 * harus `relative`.
 */
export function NotificationDot({ visible = true, className }: { visible?: boolean; className?: string }) {
  if (!visible) return null
  return (
    <View
      accessible
      accessibilityLabel="Ada pembaruan"
      className={cn(
        "absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full border border-background bg-danger",
        className,
      )}
    />
  )
}
