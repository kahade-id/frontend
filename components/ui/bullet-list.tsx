/**
 * Kahade — <BulletList> daftar teks bermarker (§3 tipografi, §4 spacing).
 *
 * Untuk konten naratif berbutir: syarat & ketentuan, manfaat paket,
 * langkah instruksi ("Cara membayar via QRIS"), alasan penolakan KYC.
 * RN tidak punya <ul>/<ol>, dan menulis "• " di string membuat baris
 * lanjutan (wrap) tidak menggantung rapi di bawah teks — marker harus
 * kolom terpisah.
 *
 * Marker:
 *   - "bullet" (default): titik 6px `bg-text-tertiary` (warna ikon default §7)
 *   - "number"          : angka Sofia Sans caption 600 tabular — bukan Mono,
 *                         karena angka menyatu dengan kalimat (§3.1)
 *   - "check"           : Phosphor Check weight bold tone active — untuk
 *                         daftar manfaat/yang sudah terpenuhi
 *   - "icon"            : ikon Phosphor kustom per item (`item.icon`)
 *
 * Keputusan non-obvious:
 *   - Kolom marker lebar tetap 20px (space[5]) + gap 8px (§7 ikon-teks),
 *     tingginya = lineHeight varian teks (dari tokens, lewat style numerik
 *     karena bergantung variant — pengecualian non-className yang sama
 *     dengan <Skeleton>). Marker `justify-center` di dalam kotak setinggi
 *     satu baris -> selalu sejajar dengan baris PERTAMA teks, bukan tengah
 *     paragraf.
 *   - Gap antar item space[2] (8px): daftar adalah satu blok bacaan, bukan
 *     elemen terpisah (yang memakai 16px).
 *   - Item string dirender lewat <Text>; ReactNode diteruskan apa adanya
 *     supaya bisa menyisipkan <Emphasis>/<TextLink inline>.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { Check } from "phosphor-react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type BulletListMarker = "bullet" | "number" | "check" | "icon"
export type BulletListVariant = "bodyLarge" | "body" | "caption"

export type BulletListItem =
  | string
  | {
      content: ReactNode
      /** Hanya dipakai saat marker="icon" */
      icon?: IconComponent
      key?: string
    }

export type BulletListProps = Omit<ViewProps, "children"> & {
  items: BulletListItem[]
  marker?: BulletListMarker
  variant?: BulletListVariant
  tone?: Extract<TextTone, "primary" | "secondary" | "inherit">
  /** Angka mulai dari (marker="number"). Default 1. */
  start?: number
  className?: string
}

export function BulletList({
  items,
  marker = "bullet",
  variant = "body",
  tone = "primary",
  start = 1,
  className,
  ...rest
}: BulletListProps) {
  const lineHeight = tokens.typography[variant].lineHeight

  return (
    <View accessibilityRole="list" className={cn("w-full gap-2", className)} {...rest}>
      {items.map((raw, i) => {
        const item = typeof raw === "string" ? { content: raw } : raw
        const key = item.key ?? String(i)
        return (
          <View key={key} className="flex-row items-start gap-2">
            {/* Kolom marker: lebar tetap, tinggi satu baris teks */}
            <View className="w-5 items-center justify-center" style={{ height: lineHeight }}>
              {marker === "bullet" ? (
                <View className="h-[6px] w-[6px] rounded-full bg-text-tertiary" />
              ) : marker === "number" ? (
                <Text variant="caption" weight={600} tone="secondary">
                  {`${start + i}.`}
                </Text>
              ) : marker === "check" ? (
                <Icon icon={Check} size="xs" tone="active" weight="bold" />
              ) : item.icon ? (
                <Icon icon={item.icon} size="xs" tone="default" />
              ) : null}
            </View>

            <View className="flex-1">
              {typeof item.content === "string" ? (
                <Text variant={variant} tone={tone}>
                  {item.content}
                </Text>
              ) : (
                item.content
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}
