/**
 * Kahade — <Presence> mount/unmount beranimasi (§8 motion overlay).
 *
 * Pelengkap <FadeIn>: FadeIn menganimasikan opacity tapi anak TETAP di tree
 * saat `visible=false` (memakan layout, perlu pointerEvents none). Untuk
 * konten yang harus benar-benar hilang — helper error yang muncul/lenyap,
 * baris ringkasan biaya yang tergantung pilihan, tombol sekunder yang
 * hanya ada di state tertentu — kita butuh: masuk beranimasi, keluar
 * beranimasi, LALU unmount. Itu tugas Presence.
 *
 * Implementasi memakai `useOverlayPresence` dari backdrop.tsx (sudah
 * menangani mounted-state + progress Animated.Value + onHidden) supaya
 * durasi masuk/keluar (250/200ms) dan easing satu sumber dengan Modal/
 * Tooltip — bukan timer baru. Gerakan: fade + translateY 8px + scale 0.97,
 * bahasa yang sama dengan `motion.overlay` (§8 catatan tokens).
 *
 * Keputusan non-obvious:
 *   - Default `translate=true`, `scale=false`: konten inline biasanya
 *     bergeser naik, sedangkan scale disisakan untuk elemen yang "muncul di
 *     tempat" (popover/kartu konfirmasi). Keduanya opt-in per pemakaian.
 *   - `pointerEvents="none"` saat keluar: user tidak boleh menekan elemen
 *     yang sedang menghilang (mis. tombol yang sudah tidak valid).
 *   - Tidak menganimasikan `height` (layout). Collapse height ada di
 *     <Collapse>; Presence sengaja hanya opacity/transform (native driver,
 *     60fps) — kalau perlu ruang ikut menutup, bungkus dengan Collapse.
 */
import type { ReactNode } from "react"
import { Animated, type ViewProps } from "react-native"

import { useOverlayPresence } from "@/components/ui/backdrop"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type PresenceProps = Omit<ViewProps, "children" | "style"> & {
  visible: boolean
  children: ReactNode
  /** Geser 8px dari bawah saat masuk (default true) */
  translate?: boolean
  /** Scale dari 0.97 saat masuk (default false) */
  scale?: boolean
  durationIn?: number
  durationOut?: number
  /** Dipanggil setelah animasi keluar selesai & anak di-unmount */
  onHidden?: () => void
  className?: string
}

export function Presence({
  visible,
  children,
  translate = true,
  scale = false,
  durationIn,
  durationOut,
  onHidden,
  ...rest
}: PresenceProps) {
  const reducedMotion = useReducedMotion() // respect OS reduced motion (WCAG 2.3.3)
  const { mounted, progress } = useOverlayPresence(visible, { durationIn, durationOut, onHidden })

  if (!mounted) return null

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [translate ? tokens.motion.overlay.translateY : 0, 0],
  })
  const scaleValue = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [scale ? tokens.motion.overlay.scaleFrom : 1, 1],
  })

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={{ opacity: progress, transform: [{ translateY }, { scale: scaleValue }] }}
      {...rest}
    >
      {children}
    </Animated.View>
  )
}