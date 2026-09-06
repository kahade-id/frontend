/**
 * Kahade — <Heading> / <DisplayHeading> / <SectionTitle> (§3.2, §1.4).
 *
 * Shortcut semantik di atas <Text> agar pemanggil memilih PERAN, bukan
 * variant:
 *   - <Heading level={1|2|3}>  -> h1/h2/h3 Sofia Sans (H1/H2 turun ke 600 di
 *                                dark mode otomatis lewat Text).
 *   - <DisplayHeading>         -> EB Garamond 34/42 — TERBATAS untuk hero
 *                                onboarding, konfirmasi besar, welcome (§1.4).
 *                                Bukan untuk judul halaman biasa.
 *   - <SectionTitle>           -> baris judul section (H2/H3) + aksi kanan
 *                                opsional ("Lihat semua"), pola di dashboard
 *                                dan list beranda.
 *
 * `accessibilityRole="header"` diset di semua heading supaya screen reader
 * bisa lompat antar judul — Text biasa tidak mendapat role ini.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Text, type TextProps } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type HeadingLevel = 1 | 2 | 3

export type HeadingProps = Omit<TextProps, "variant"> & { level?: HeadingLevel }

export function Heading({ level = 1, tone = "primary", ...rest }: HeadingProps) {
  const variant = level === 1 ? "h1" : level === 2 ? "h2" : "h3"
  return <Text accessibilityRole="header" variant={variant} tone={tone} {...rest} />
}

export type DisplayHeadingProps = Omit<TextProps, "variant" | "weight">

/** EB Garamond — hero / konfirmasi besar / onboarding saja */
export function DisplayHeading({ tone = "primary", className, ...rest }: DisplayHeadingProps) {
  return (
    <Text
      accessibilityRole="header"
      variant="display"
      tone={tone}
      className={cn("text-balance", className)}
      {...rest}
    />
  )
}

export type SectionTitleProps = Omit<ViewProps, "children"> & {
  title: string
  subtitle?: string
  level?: 2 | 3
  /** Slot kanan, mis. <TextLink>Lihat semua</TextLink> */
  action?: ReactNode
  className?: string
}

export function SectionTitle({
  title,
  subtitle,
  level = 3,
  action,
  className,
  ...rest
}: SectionTitleProps) {
  return (
    <View accessible={false} className={cn("w-full flex-row items-end justify-between gap-3", className)} {...rest}>
      <View className="flex-1 gap-1">
        <Heading level={level} numberOfLines={1}>
          {title}
        </Heading>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  )
}
