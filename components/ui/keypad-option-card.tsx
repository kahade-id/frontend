/**
 * Kahade — <KeypadOptionCard> kartu pilihan ringkas yang diletakkan TEPAT DI
 * ATAS keypad nominal (top-up: metode pembayaran; transfer: catatan; tarik
 * dana: rekening tujuan).
 *
 * Ketuk kartu → buka BottomSheet pemilih/editor di layar yang sama, sehingga
 * konteks nominal tidak pernah hilang dan pengguna tidak masuk ke langkah
 * terpisah hanya untuk memilih opsi.
 *
 * Struktur: label kecil di kiri atas, baris isi [leading?] judul/nilai +
 * deskripsi opsional + CaretRight di kanan. Dibangun di atas <Card onPress>
 * sehingga sudah mendapat PressableScale, elevasi interaktif, focus ring,
 * dan label aksesibilitas.
 */
import type { ReactNode } from "react"
import { CaretRight } from "phosphor-react-native"

import { Card } from "@/components/ui/card"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { View } from "react-native"
import { cn } from "@/lib/cn"

export type KeypadOptionCardProps = {
  /** Label kecil di atas nilai, mis. "Metode pembayaran" */
  label: string
  /** Nilai terpilih, mis. "BCA Virtual Account" */
  value?: string
  /** Tampil saat belum ada pilihan, mis. "Pilih metode pembayaran" */
  placeholder?: string
  /** Baris kecil di bawah nilai (biaya, ringkasan catatan, nomor rekening) */
  description?: string
  /** Ikon kategori di kiri nilai */
  icon?: IconComponent
  /** Slot leading kustom (menggantikan ikon), mis. inisial bank */
  leading?: ReactNode
  onPress: () => void
  disabled?: boolean
  accessibilityHint?: string
  className?: string
}

export function KeypadOptionCard({
  label,
  value,
  placeholder = "Pilih",
  description,
  icon,
  leading,
  onPress,
  disabled = false,
  accessibilityHint,
  className,
}: KeypadOptionCardProps) {
  const hasValue = Boolean(value)
  return (
    <Card
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={value ? `${label}: ${value}` : `${label}. ${placeholder}`}
      accessibilityHint={accessibilityHint ?? "Ketuk untuk mengubah pilihan"}
      className={cn("w-full", className)}
    >
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View className="mt-1 flex-row items-center gap-3">
        {leading ??
          (icon ? (
            <View className="h-9 w-9 items-center justify-center rounded-sm bg-surface">
              <Icon icon={icon} size="sm" tone="active" />
            </View>
          ) : null)}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            variant="bodyLarge"
            weight={600}
            tone={hasValue ? "primary" : "disabled"}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {value ?? placeholder}
          </Text>
          {description ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
        <Icon icon={CaretRight} size="sm" tone="default" />
      </View>
    </Card>
  )
}
