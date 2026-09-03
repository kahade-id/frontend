/**
 * Kahade — <Banner> (§9.11 Feedback/Notifikasi, §6.2 layer 70).
 *
 * Pesan yang MENGAMBANG di atas layar: posisi atas, persist sampai di-dismiss
 * (default), dan dirender di `z-banner` (70) — DI ATAS Modal (60) supaya
 * status/error kritikal tetap terlihat saat dialog terbuka. §9.11 juga
 * menetapkan Banner dipakai untuk feedback ringan ("Tersimpan", "Disalin")
 * — untuk kasus itu kirim `autoHideMs`.
 *
 * Beda dengan <Alert banner>: Alert adalah blok INLINE di dalam layout
 * (ikut scroll, di bawah Header). Banner ini overlay lewat <Portal>, tidak
 * menggeser konten, dan punya animasi masuk/keluar. Secara visual keduanya
 * sama karena Banner memang merender <Alert banner> di dalamnya — satu
 * sumber tampilan, dua cara penempatan.
 *
 * Keputusan non-obvious:
 *   - Animasi memakai `useOverlayPresence` (fade) + translateY dari -space.4,
 *     BUKAN spring: spring disediakan untuk bottom sheet (§8); banner masuk
 *     dari tepi atas cukup fade+geser kecil agar tidak mencuri perhatian.
 *   - Safe area top dipasang sebagai paddingTop wrapper (nilai runtime,
 *     bukan token → style), banner itu sendiri tetap full-bleed.
 *   - Di web dibatasi `md:max-w-content` (§11) supaya sejajar dengan kolom
 *     konten 520px, bukan membentang selebar viewport desktop.
 *   - `pointerEvents="box-none"` pada wrapper: area kosong di sekitar banner
 *     tidak menelan tap ke konten di bawahnya.
 */
import { useEffect } from "react"
import { Animated, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Alert, type AlertProps } from "@/components/ui/alert"
import { useOverlayPresence } from "@/components/ui/backdrop"
import { Portal } from "@/components/ui/portal"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type BannerProps = Omit<AlertProps, "banner"> & {
  visible: boolean
  /** Tutup otomatis setelah N ms (feedback ringan). Undefined = persist (§9.11). */
  autoHideMs?: number
  /** Dipanggil setelah animasi keluar selesai */
  onHidden?: () => void
}

export function Banner({
  visible,
  autoHideMs,
  onDismiss,
  onHidden,
  variant = "outline",
  className,
  ...alert
}: BannerProps) {
  const insets = useSafeAreaInsets()
  const { mounted, progress } = useOverlayPresence(visible, { onHidden })

  useEffect(() => {
    if (!visible || !autoHideMs || !onDismiss) return
    const t = setTimeout(onDismiss, autoHideMs)
    return () => clearTimeout(t)
  }, [visible, autoHideMs, onDismiss])

  if (!mounted) return null

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-tokens.space[4], 0],
  })

  return (
    <Portal>
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 top-0 z-banner items-center"
        style={{ paddingTop: insets.top }}
      >
        <View pointerEvents="box-none" className="w-full md:max-w-content">
          <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
            <Alert
              banner
              variant={variant}
              onDismiss={onDismiss}
              className={cn("border-b border-border", className)}
              {...alert}
            />
          </Animated.View>
        </View>
      </View>
    </Portal>
  )
}
