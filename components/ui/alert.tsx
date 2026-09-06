/**
 * Alert — pesan inline/banner untuk memberi konteks pada layar (bukan
 * notifikasi sementara; untuk itu pakai Toast).
 *
 * Keputusan:
 *   1. Dua variant: `soft` (bg-*-soft, tanpa border) untuk konten dalam layar
 *      dan `outline` (bg-surface + border-border) untuk konteks netral. Tidak
 *      ada variant "solid" berwarna karena §6 melarang blok warna pekat besar —
 *      warna semantik hanya muncul lewat ikon + teks + soft fill.
 *   2. `tone="neutral"` sengaja tidak memakai warna: ikon text-tertiary, teks
 *      text-secondary. Ini default agar Alert tidak "berteriak".
 *   3. `banner` = full-bleed (radius 0, tanpa margin) untuk dipasang di bawah
 *      TopBar; default punya rounded-md dan bisa diletakkan di antara konten.
 *   4. Dismiss memakai IconButton ghost sm agar hit area tetap 44px meski
 *      ikon 16px (§10 aksesibilitas).
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { CheckCircle, Info, Warning, WarningCircle, X } from "phosphor-react-native"

import { cn } from "@/lib/cn"
import { Icon, type IconComponent, type IconTone } from "./icon"
import { IconButton } from "./icon-button"
import { Text, type TextTone } from "./text"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type AlertTone = "neutral" | "success" | "danger" | "warning" | "info"
export type AlertVariant = "soft" | "outline"

export type AlertProps = Omit<ViewProps, "children"> & {
  tone?: AlertTone
  variant?: AlertVariant
  title?: string
  /** Isi pesan; string atau node kustom (mis. Text dengan TextLink) */
  children?: ReactNode
  /** Override ikon default per tone; `null` = tanpa ikon */
  icon?: IconComponent | null
  /** Tampilkan tombol X; onDismiss dipanggil saat ditekan */
  onDismiss?: () => void
  /** Aksi opsional di bawah pesan (mis. <Button size="sm" variant="ghost">) */
  action?: ReactNode
  /** Full-bleed tanpa radius, untuk di bawah TopBar */
  banner?: boolean
  className?: string
}

const defaultIcon: Record<AlertTone, IconComponent> = {
  neutral: Info,
  success: CheckCircle,
  danger: WarningCircle,
  warning: Warning,
  info: Info,
}

const softBox: Record<AlertTone, string> = {
  neutral: "bg-surface border border-border",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
}

const iconTone: Record<AlertTone, IconTone> = {
  neutral: "default",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

const titleTone: Record<AlertTone, TextTone> = {
  neutral: "primary",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

export function Alert({
  tone = "neutral",
  variant = "soft",
  title,
  children,
  icon,
  onDismiss,
  action,
  banner = false,
  className,
  ...rest
}: AlertProps) {
  const IconCmp = icon === null ? null : (icon ?? defaultIcon[tone])
  const isOutline = variant === "outline"

  return (
    <View accessible={false}
      accessibilityRole="alert"
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
      className={cn(
        "flex-row items-start gap-3 px-4 py-3",
        isOutline ? "bg-surface border border-border" : softBox[tone],
        banner ? "rounded-none border-x-0" : "rounded-md",
        className,
      )}
      {...rest}
    >
      {IconCmp ? (
        <View className="pt-[2px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <Icon icon={IconCmp} size="sm" tone={iconTone[tone]} weight="fill" />
        </View>
      ) : null}

      <View className="flex-1 gap-1">
        {title ? (
          <Text variant="body" weight={600} tone={titleTone[tone]}>
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? (
          <Text variant="caption" tone="secondary">
            {children}
          </Text>
        ) : (
          children
        )}
        {action ? <View className="flex-row pt-1">{action}</View> : null}
      </View>

      {onDismiss ? (
        <IconButton
          icon={X}
          variant="ghost"
          size="sm"
          accessibilityLabel="Tutup pesan"
          accessibilityHint="Menutup pesan ini"
          onPress={onDismiss}
          className="-mr-1 -mt-1 ml-1"
        />
      ) : null}
    </View>
  )
}