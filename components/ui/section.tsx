/**
 * Kahade — <Section> + <SectionHeader> blok konten berjudul (§3.2 H2/H3, §4).
 *
 * Unit penyusun layar: judul section + (opsional) subjudul + aksi kanan
 * ("Lihat Semua" TextLink) + isi. Jarak internal judul→isi = space.4 (16px);
 * jarak ANTAR section = space.8 (32px) dan itu tanggung jawab parent
 * (`<VStack gap={8}>`), bukan margin di Section — konsisten dengan aturan
 * gap-bukan-margin di stack.tsx.
 *
 * Keputusan non-obvious:
 *   - `level="h2"` (22/700) default untuk section utama layar; `"h3"` (18/600)
 *     untuk sub-section di dalam card. Tidak ada level lebih kecil: judul
 *     yang butuh < 18px sebenarnya adalah Label (§3.2), pakai <FieldLabel>.
 *   - Slot `action` di-align `items-end` terhadap baris judul (bukan center)
 *     agar baseline TextLink 14px sejajar dengan baseline judul 22px —
 *     mengikuti aturan §7 "align dengan baseline teks".
 *   - `inset`: beri `px-6` pada header saja — untuk Screen `padded={false}`
 *     yang isinya list full-bleed (divider menyentuh tepi) tetapi judulnya
 *     harus sejajar screen padding.
 *   - Header dipisah sebagai export sendiri supaya list virtual (FlatList
 *     ListHeaderComponent) bisa memakainya tanpa membungkus children.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type SectionLevel = "h2" | "h3"

export type SectionHeaderProps = Omit<ViewProps, "children"> & {
  title: string
  subtitle?: string
  /** Slot kanan: TextLink "Lihat Semua", IconButton, Badge */
  action?: ReactNode
  level?: SectionLevel
  /** px-6 hanya pada header (untuk Screen padded={false}) */
  inset?: boolean
  className?: string
}

export function SectionHeader({
  title,
  subtitle,
  action,
  level = "h2",
  inset = false,
  className,
  ...rest
}: SectionHeaderProps) {
  return (
    <View
      accessibilityRole="header"
      className={cn("flex-row items-end justify-between gap-4", inset && "px-6", className)}
      {...rest}
    >
      <View className="flex-1 gap-1">
        <Text variant={level} tone="primary" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View className="shrink-0 pb-1">{action}</View> : null}
    </View>
  )
}

export type SectionProps = Omit<SectionHeaderProps, "title"> & {
  /** Tanpa title = hanya wrapper gap; berguna untuk section anonim */
  title?: string
  children?: ReactNode
  /** Jarak judul → isi. Default "md" (16px); "sm" (8px) untuk isi berupa caption */
  gap?: "sm" | "md"
}

export function Section({
  title,
  subtitle,
  action,
  level = "h2",
  inset = false,
  gap = "md",
  children,
  className,
  ...rest
}: SectionProps) {
  return (
    <View className={cn("w-full", gap === "sm" ? "gap-2" : "gap-4", className)} {...rest}>
      {title ? (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          action={action}
          level={level}
          inset={inset}
        />
      ) : null}
      {children}
    </View>
  )
}
