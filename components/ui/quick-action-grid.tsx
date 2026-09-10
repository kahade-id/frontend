/**
 * Kahade — <QuickActionGrid> pintasan beranda (§9.1 Button, §4 grid, §7 ikon).
 *
 * Dua tata letak untuk kumpulan pintasan sekunder Beranda (Isi Saldo, Order
 * Link, Chat, Sengketa, …) yang tidak layak jadi tombol penuh satu per satu:
 *   - `layout="grid"` (default): ubin ikon 48 kotak `bg-surface` + label
 *     caption, 4 kolom tetap (`w-1/4`), ubin ke-5 dst turun baris.
 *   - `layout="row"` (redesign Beranda 2026-09): deret ikon BULAT 56px yang
 *     di-scroll horizontal — pola "app hub" yang lazim di super app
 *     Indonesia. Lebar tiap ubin tetap (`w-[72px]`) supaya label 2 baris
 *     tidak mengubah lebar ubin lain; item di luar layar terpotong di tepi
 *     kanan sebagai isyarat "masih ada lagi" (§1 tenang, tanpa scrollbar).
 *
 * Keputusan non-obvious:
 *   - Dibangun di atas <PressableScale> (bukan Button) supaya ubin bisa
 *     ikon-di-atas-label; pressed-scale tetap sama dengan tombol lain.
 *     Tinggi target sentuh ≥ 44 (kotak ikon 48 / lingkaran 56).
 *   - `emphasis` (layout row): SATU pintasan boleh memakai lingkaran
 *     inverted (bg-primary + ikon inverse) sebagai aksi utama layar — di
 *     Beranda itu "Buat transaksi". Lebih dari satu = tidak ada yang menonjol.
 *   - Kotak/lingkaran ikon `bg-surface dark:bg-surface-elevated`: di dark,
 *     surface terlalu dekat background sehingga ubin lenyap — naik satu
 *     level seperti IconBox surface (§6 hierarki; terdaftar di
 *     DARK_ALLOWLIST check-tokens).
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
import { ScrollRow } from "@/components/ui/scroll-row"
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
  /** Lingkaran inverted sebagai aksi utama — hanya SATU per deret (layout row) */
  emphasis?: boolean
  disabled?: boolean
  accessibilityHint?: string
}

export type QuickActionLayout = "grid" | "row"

export type QuickActionGridProps = Omit<ViewProps, "children"> & {
  actions: readonly QuickAction[]
  layout?: QuickActionLayout
  /**
   * Hanya layout row: padding awal/akhir 24px agar ubin pertama sejajar
   * judul di atasnya (default true — dipakai di Screen padded={false}).
   */
  inset?: boolean
  className?: string
}

function ActionTile({ action: a, layout }: { action: QuickAction; layout: QuickActionLayout }) {
  const row = layout === "row"
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a.badge ? `${a.label}, ${a.badge} perlu perhatian` : a.label}
      accessibilityHint={a.accessibilityHint ?? `Buka ${a.label}`}
      accessibilityState={{ disabled: a.disabled }}
      disabled={a.disabled}
      haptic
      onPress={a.onPress}
      containerClassName={cn(row ? "w-[72px]" : "w-1/4", focusRingInset)}
      className={cn("items-center gap-2 px-1 py-2", a.disabled && "opacity-disabled")}
    >
      <View
        className={cn(
          "relative items-center justify-center",
          row ? "h-14 w-14 rounded-full" : "h-12 w-12 rounded-sm",
          a.emphasis && row
            ? "bg-primary"
            : "bg-surface-elevated dark:bg-surface-elevated",
        )}
      >
        <Icon
          icon={a.icon}
          size="md"
          tone={a.emphasis && row ? "inverse" : "active"}
          weight={a.emphasis && row ? "fill" : undefined}
        />
        {a.badge ? (
          <View className="absolute -right-1 -top-1">
            <Badge tone="danger" variant="soft">
              {a.badge > 99 ? "99+" : String(a.badge)}
            </Badge>
          </View>
        ) : null}
      </View>
      <Text
        ellipsizeMode="tail"
        variant="caption"
        weight={a.emphasis && row ? 600 : 400}
        tone="primary"
        numberOfLines={2}
        className="text-center"
      >
        {a.label}
      </Text>
    </PressableScale>
  )
}

export function QuickActionGrid({
  actions,
  layout = "grid",
  inset = true,
  className,
  ...rest
}: QuickActionGridProps) {
  if (layout === "row") {
    return (
      <ScrollRow gap={1} inset={inset} align="start" className={className} {...rest}>
        {actions.map((a) => (
          <ActionTile key={a.key} action={a} layout="row" />
        ))}
      </ScrollRow>
    )
  }
  return (
    <View className={cn("flex-row flex-wrap", className)} {...rest}>
      {actions.map((a) => (
        <ActionTile key={a.key} action={a} layout="grid" />
      ))}
    </View>
  )
}
