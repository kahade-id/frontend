/**
 * Kahade — tombol apung "gulir ke ujung" untuk daftar/thread panjang.
 *
 * Kenapa komponen sendiri: setiap permukaan panjang (chat, riwayat transaksi,
 * komentar) butuh jalan kembali ke ujung tanpa menggulir manual, dan versi
 * salin-tempel selalu berbeda (ukuran, bayangan, posisi). Satu primitif =
 * satu tinggi (40), satu bayangan (medium), satu ikon.
 *
 * Keputusan non-obvious:
 *   - `visible` dikendalikan pemanggil (dari onScroll), bukan dihitung di
 *     sini: hanya layar yang tahu ambang "masih di ujung" untuk kontennya.
 *   - Bayangan dipasang di View pembungkus karena <PressableScale> tidak
 *     menerima `style`; `elevationStyle("medium")` adalah satu-satunya jalan
 *     memakai shadow (§5.2).
 *   - `pointerEvents` tidak dipakai (ditolak audit #5): tombol ini selalu
 *     menerima sentuhan, dan saat tersembunyi ia tidak dirender sama sekali —
 *     tidak ada lapisan transparan yang bisa menahan ketukan di atas composer.
 */
import { View } from "react-native"

import { CaretDown } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { cn } from "@/lib/cn"
import { elevationStyle } from "@/lib/elevation"
import { focusRing } from "@/lib/focus-ring"

export type ScrollToEndButtonProps = {
  /** Tampilkan hanya saat pembaca meninggalkan ujung daftar. */
  visible: boolean
  onPress: () => void
  /**
   * Label screen reader — WAJIB dari pemanggil. Nilai default di parameter
   * tidak terbaca generator katalog i18n (hanya children JSX, properti objek,
   * dan atribut JSX yang dipindai), jadi copy-nya harus ditulis di titik pakai.
   */
  label: string
  /** Penataan letak pembungkus (mis. "items-end px-5 pb-2"). */
  className?: string
}

export function ScrollToEndButton({
  visible,
  onPress,
  label,
  className,
}: ScrollToEndButtonProps) {
  const { mode } = useTheme()
  if (!visible) return null

  return (
    <View className={cn("items-end", className)}>
      <View style={elevationStyle("medium", mode)} className="rounded-full">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={label}
          scaleOnPress={false}
          ripple
          onPress={onPress}
          containerClassName={cn("rounded-full border border-border bg-background", focusRing)}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <Icon icon={CaretDown} size="sm" tone="active" weight="bold" />
        </PressableScale>
      </View>
    </View>
  )
}
