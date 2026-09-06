/**
 * Kahade — <QuickActionGrid> pintasan beranda (§9.1 Button, §4 grid, §7 ikon).
 *
 * Deret ubin kecil: ikon 24 di dalam kotak `bg-surface` + label caption di
 * bawah, 4 kolom di lebar mobile. Untuk pintasan sekunder Beranda (Isi
 * Saldo, Order Link, Chat, Sengketa, …) yang tidak layak jadi tombol penuh
 * satu per satu — daftar tombol vertikal akan mendorong ringkasan keluar
 * layar.
 *
 * Keputusan non-obvious:
 *   - Dibangun di atas <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"> (bukan Button) supaya ubin bisa
 *     ikon-di-atas-label; radius `rounded-sm` dan pressed-scale tetap sama
 *     dengan tombol lain. Tinggi target sentuh ≥ 44 (kotak ikon 48).
 *   - Kolom = 4 tetap (`w-1/4`) bukan flex-wrap bebas, supaya label 2 baris
 *     tidak mengubah lebar ubin lain; ubin ke-5 dst turun ke baris baru.
 *   - Badge angka (mis. sengketa aktif) opsional di pojok kotak ikon —
 *     memakai <Badge tone="danger"> yang sama dengan tab bar, bukan titik
 *     custom.
 *   - Label dibatasi 2 baris + `text-center`; pemanggil pilih kata pendek
 *     (§12) — komponen tidak menyingkat.
 */
import { View, type ViewProps } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRingInset } from "@/lib/focus-ring"

export type QuickAction = {
  key: string
  icon: IconComponent
  label: string
  onPress: () => void
  /** Angka kecil di pojok ikon (mis. jumlah sengketa aktif) */
  badge?: number
  disabled?: boolean
  accessibilityHint?: string
}

export type QuickActionGridProps = Omit<ViewProps, "children"> & {
  actions: readonly QuickAction[]
  className?: string
}

export function QuickActionGrid({ actions, className, ...rest }: QuickActionGridProps) {
  return (
    <View accessible={false} className={cn("flex-row flex-wrap", className)} {...rest}>
      {actions.map((a) => (
        <PressableScale
          key={a.key}
          accessibilityRole="button"
          accessibilityLabel={a.badge ? `${a.label}, ${a.badge} notifikasi baru` : a.label}
          accessibilityHint={a.accessibilityHint ?? `Buka ${a.label}`}
          accessibilityState={{ disabled: a.disabled }}
          disabled={a.disabled}
          haptic
          onPress={a.onPress}
          containerClassName={cn("w-1/4", focusRingInset)}
          className={cn("items-center gap-2 px-1 py-2", a.disabled && "opacity-disabled")}
        >
          <View className="relative h-12 w-12 items-center justify-center rounded-sm border border-border bg-surface">
            <Icon icon={a.icon} size="md" tone="active" />
            {a.badge ? (
              <View className="absolute -right-1 -top-1">
                <Badge tone="danger" variant="soft">
                  {a.badge > 99 ? "99+" : String(a.badge)}
                </Badge>
              </View>
            ) : null}
          </View>
          <Text variant="caption" tone="primary" numberOfLines={2} className="text-center">
            {a.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  )
}
