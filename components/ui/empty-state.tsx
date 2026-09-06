/**
 * Kahade — <EmptyState> (§9.12).
 *
 * Konten pengganti saat data kosong: list transaksi baru, hasil pencarian
 * nihil, belum ada rekening tersimpan. Bukan untuk error jaringan (pakai
 * <ErrorState>) dan bukan untuk loading (Skeleton / LoadingScreen).
 *
 * Keputusan non-obvious:
 *   1. Ikon Phosphor besar (xl) dengan tone `text-tertiary` — eksplisit dari
 *      §9.12 v1.1 (bukan text-secondary). Ikon dibungkus <IconBox size="xl">
 *      varian surface supaya ada "bidang" bertepi tanpa shadow (§6) — ini
 *      satu-satunya elemen visual, sisanya teks.
 *   2. Judul memakai H3 (bukan H2) karena empty state duduk DI DALAM layar
 *      yang sudah punya judul sendiri; hirarki header tidak boleh bertabrakan.
 *   3. Aksi maksimal dua: `action` (Button primary/secondary, fullWidth=false)
 *      dan `secondaryAction` (biasanya ghost). Lebih dari dua berarti layar
 *      ini bukan empty state melainkan menu.
 *   4. `compact` untuk empty state di dalam kartu/section (bukan full-screen):
 *      ikon lg, judul body 600, padding lebih rapat. Default = full (py-12)
 *      dan `flex-1` agar terpusat vertikal saat menjadi satu-satunya anak
 *      Screen.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { IconBox } from "./icon-box"
import type { IconComponent } from "./icon"
import { Text } from "./text"

export type EmptyStateProps = Omit<ViewProps, "children"> & {
  icon: IconComponent
  title: string
  description?: string
  /** Tombol utama — kirim <Button accessibilityHint="Ketuk untuk berinteraksi" fullWidth={false}> */
  action?: ReactNode
  /** Tombol kedua (ghost) di bawah aksi utama */
  secondaryAction?: ReactNode
  /** Versi rapat untuk di dalam Card/Section */
  compact?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <View accessible={false}
      accessibilityRole="summary"
      className={cn(
        "w-full items-center justify-center",
        compact ? "gap-3 py-6" : "flex-1 gap-4 py-12",
        className,
      )}
      {...rest}
    >
      <IconBox icon={icon} size={compact ? "lg" : "xl"} variant="surface" weight="regular" />

      <View className={cn("items-center", compact ? "gap-1" : "gap-2", "max-w-[320px] mx-auto")}>
        {compact ? (
          <Text variant="body" weight={600} className="text-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            {title}
          </Text>
        ) : (
          <Text variant="h3" className="text-center">
            {title}
          </Text>
        )}
        {description ? (
          <Text variant={compact ? "caption" : "body"} tone="secondary" className="text-center">
            {description}
          </Text>
        ) : null}
      </View>

      {action || secondaryAction ? (
        <View className={cn("items-center gap-2", compact ? "pt-1" : "pt-2")}>
          {action}
          {secondaryAction}
        </View>
      ) : null}
    </View>
  )
}
