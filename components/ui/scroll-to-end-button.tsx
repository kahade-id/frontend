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
 *   - 2026-10-08: masuk/keluar MEMUDAR (fade + naik 8px lewat <FadeIn>, RN
 *     Animated native driver — pola pressable-scale/fade-in, bukan reanimated).
 *     Sebelumnya tombol muncul/hilang seketika ("pop"). Setelah animasi
 *     keluar selesai komponen melepas diri (`mounted=false`) sehingga
 *     invarian "tersembunyi = tidak dirender" tetap berlaku; `visible=false`
 *     sejak awal → tidak pernah dirender.
 *   - Revisi 2026-09-27 (UI polish): circle KOMPAK 40dp, ikon panah-bawah di
 *     tengah, shadow lembut. Dirender in-flow di atas composer (items-end +
 *     margin aman), BUKAN absolute mengambang — supaya tidak pernah menutupi
 *     konten chat. Target sentuh efektif 44dp lewat hitSlop (visual tetap
 *     40dp), sesuai konvensi UI-C005.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"

import { CaretDown } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { FadeIn } from "@/components/ui/fade-in"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { elevationStyle } from "@/lib/elevation"
import { focusRing } from "@/lib/focus-ring"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate } from "@/lib/i18n/translate"

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
  /**
   * Jumlah pesan baru yang masuk saat pembaca di atas (B03). > 0 →
   * badge angka di sudut tombol.
   */
  count?: number
  /** Penataan letak pembungkus (mis. "items-end px-5 pb-2"). */
  className?: string
}

export function ScrollToEndButton({
  visible,
  onPress,
  label,
  count = 0,
  className,
}: ScrollToEndButtonProps) {
  const { mode } = useTheme()
  // Tetap ter-mount selama animasi keluar; dilepas saat fade-out selesai.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])
  const handleHidden = useCallback(() => setMounted(false), [])
  if (!visible && !mounted) return null

  return (
    <FadeIn
      visible={visible}
      duration="fast"
      easing={visible ? "enter" : "exit"}
      onHidden={handleHidden}
      className={cn("items-end", className)}
    >
      <View style={elevationStyle("medium", mode)} className="rounded-full">
        <PressableScale
          testID="scroll-to-end-button"
          accessibilityRole="button"
          accessibilityLabel={
            count > 0 ? translate("{x} ({y} pesan baru)", { x: label, y: count }) : label
          }
          scaleOnPress={false}
          ripple
          onPress={onPress}
          // Visual tetap circle 40dp; target sentuh efektif 44dp (UI-C005).
          hitSlop={hitSlopToReach(40, 40)}
          containerClassName={cn("rounded-full border border-border bg-background", focusRing)}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <Icon icon={CaretDown} size="sm" tone="active" weight="bold" />
          {/* B03: badge jumlah pesan baru — pill merah di sudut kanan atas. */}
          {count > 0 ? (
            <View
              className="absolute -right-1 -top-1 min-w-5 items-center justify-center rounded-full bg-danger px-1"
              style={styles.noTouch}
            >
              {/* UX-COL-002 (audit UI/UX 2026-10-01): bg-danger di dark = #F87171
                  (terang) — text-white polos hanya 2.77:1. Ikuti pola
                  button.tsx:77 / count-badge.tsx:58: dark:text-gray-950. */}
              <Text variant="caption" weight={700} className="text-white dark:text-gray-950 tabular-nums">
                {count > 99 ? "99+" : String(count)}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>
    </FadeIn>
  )
}

const styles = {
  noTouch: { pointerEvents: "none" as const },
}
