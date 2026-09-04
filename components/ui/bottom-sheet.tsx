/**
 * Kahade — <BottomSheet> (§9.9, §10, §8 "spring").
 *
 * Sheet dari bawah untuk form pendek, pilihan/filter, preview cepat, action
 * menu, konfirmasi PIN (§10). Tinggi mengikuti konten (auto), maksimum 90%
 * tinggi window; konten lebih panjang harus di-scroll di dalam `children`
 * (pakai ScrollView sendiri) atau — lebih baik — pindah ke layar Push (§10).
 *
 * Anatomi: handle (garis pendek) -> header opsional (judul + tombol X) ->
 * children -> footer opsional (CTA sticky, di atas safe-area bawah).
 *
 * Keputusan non-obvious:
 *   - Animasi buka/tutup memakai reanimated `withSpring` dengan config
 *     tokens.motion.spring (§8 "Bottom sheet: spring", §15 rekomendasi
 *     reanimated). `translateY` adalah `useSharedValue` yang dibaca langsung
 *     oleh UI thread: drag mengikuti jari tanpa menunggu JS, dan spring
 *     dismiss tetap jalan mulus walau JS sibuk (mis. parent sedang fetch
 *     setelah konfirmasi). Backdrop masih memakai RN Animated (progress dari
 *     `useOverlayPresence`) — keduanya independen, sehingga Modal/ActionSheet
 *     yang berbagi Backdrop tidak perlu ikut berubah.
 *   - Sebelum tinggi sheet terukur (onLayout pertama), sheet ditaruh di
 *     translateY = tinggi window supaya tidak "kedip" di posisi akhir lalu
 *     melompat. Spring baru dimulai setelah ukuran diketahui.
 *   - Drag-to-dismiss dengan `Gesture.Pan()` di area handle+header saja
 *     (default), bukan seluruh sheet — kalau seluruh sheet, ScrollView/Slider
 *     di dalam konten akan berebut gesture. `dragArea="full"` tersedia untuk
 *     sheet statis tanpa konten scroll. `activeOffsetY(+)` hanya aktif untuk
 *     gerakan KE BAWAH; `failOffsetX` menyerahkan gerakan horizontal ke anak
 *     (mis. ScrollRow chip di header).
 *   - Ambang tutup: geser > 30% tinggi sheet ATAU velocity > 500 px/s
 *     (Gesture Handler memakai px/detik; PanResponder dulu px/ms = 0.5).
 *   - Tutup dari gesture: spring keluar dulu supaya terasa mengikuti jari,
 *     lalu `onRequestClose` dipanggil lewat `runOnJS` dari callback spring.
 *     Parent set visible=false -> `useOverlayPresence` menunggu backdrop
 *     fade lalu unmount; sheet sudah di luar layar, jadi tidak ada lompatan.
 *   - Stacking (§9.9): sheet-di-atas-sheet TIDAK diizinkan. Ada guard modul
 *     yang `console.warn` di dev bila dua sheet terbuka bersamaan — tidak
 *     dilempar error supaya app tidak crash, tapi cukup bising untuk
 *     ketahuan saat review.
 *   - Radius `rounded-t-md` (8px) — §5: bottom sheet = md. Border atas+sisi
 *     saja (`border-b-0`) karena sisi bawah menempel tepi layar.
 *   - Handle `bg-border` (bukan text-tertiary): handle adalah affordance
 *     dekoratif, bukan ikon — mengikuti warna divider agar tetap tenang.
 *   - `z-bottomSheet` (50): di atas backdrop (40), di bawah modal (60) —
 *     Dialog konfirmasi boleh muncul di atas sheet, sheet tidak boleh di
 *     atas Dialog.
 *   - Web (§11): sheet di-cap `md:max-w-content` dan di-center.
 *   - `Animated.View` reanimated tidak di-interop NativeWind -> className di
 *     <View> anak; Animated.View hanya membawa transform.
 *   - Fokus & modalitas SR (audit #3): `useBlockingOverlay` menyembunyikan
 *     konten app di belakang (portal.tsx); `useOverlayFocus` memindahkan
 *     fokus ke judul (bila ada) atau kontainer sheet, dan mengembalikannya ke
 *     `returnFocusRef` saat tutup. Turunan (ActionSheet, BankSelect, dst)
 *     otomatis ikut.
 */
import { X } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type Text as RNText,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Backdrop, useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { IconButton } from "@/components/ui/icon-button"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Portal, useBlockingOverlay } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useOverlayFocus, type A11yNodeRef } from "@/lib/use-overlay-focus"
import { useReducedMotion } from "@/lib/use-reduced-motion"

// --- Guard stacking (§9.9) -------------------------------------------------
let openSheetCount = 0
function useStackingGuard(visible: boolean) {
  useEffect(() => {
    if (!visible) return
    openSheetCount += 1
    if (__DEV__ && openSheetCount > 1) {
      console.warn(
        "[kahade/BottomSheet] Dua BottomSheet terbuka bersamaan. §9.9: sheet pertama harus close dulu sebelum sheet kedua muncul.",
      )
    }
    return () => {
      openSheetCount -= 1
    }
  }, [visible])
}

const CLOSE_RATIO = 0.3
/** px/detik (satuan velocity Gesture Handler) */
const CLOSE_VELOCITY = 500
const MAX_HEIGHT_RATIO = 0.9
/** Gerakan ke bawah (px) sebelum pan diklaim; ke atas tidak pernah aktif. */
const ACTIVE_OFFSET_Y = 6
const FAIL_OFFSET_X = 12

export type BottomSheetProps = {
  visible: boolean
  /** Diminta menutup (backdrop / drag / X / back). Parent yang set visible=false. */
  onRequestClose?: () => void
  title?: string
  /** Deskripsi kecil di bawah judul */
  description?: string
  children?: ReactNode
  /** Area sticky di bawah konten (CTA) — sudah menghitung safe-area bawah */
  footer?: ReactNode
  /** Tampilkan handle drag (default true) */
  showHandle?: boolean
  /** Tampilkan tombol X di header (default true bila ada title) */
  showClose?: boolean
  dismissOnBackdrop?: boolean
  /** Area yang merespons gesture drag (default "handle" = handle + header) */
  dragArea?: "handle" | "full" | "none"
  /** Sheet berisi input -> hindari keyboard (default false) */
  avoidKeyboard?: boolean
  /** Dipanggil setelah animasi keluar selesai */
  onHidden?: () => void
  /** className area konten (padding default px-6 pb-4) */
  contentClassName?: string
  accessibilityLabel?: string
  /** Pemicu yang menerima fokus kembali saat sheet tutup (wajib untuk native). */
  returnFocusRef?: A11yNodeRef
}

export function BottomSheet({
  visible,
  onRequestClose,
  title,
  description,
  children,
  footer,
  showHandle = true,
  showClose,
  dismissOnBackdrop = true,
  dragArea = "handle",
  avoidKeyboard = false,
  onHidden,
  contentClassName,
  accessibilityLabel,
  returnFocusRef,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { mounted, progress } = useOverlayPresence(visible, { onHidden })
  const dismiss = dismissOnBackdrop ? onRequestClose : undefined
  const sheetRef = useRef<View>(null)
  const titleRef = useRef<RNText>(null)

  useStackingGuard(visible)
  useOverlayDismissKeys(visible, dismiss)
  useBlockingOverlay(visible)
  // Judul lebih dulu (TalkBack butuh node yang accessible); tanpa judul
  // fallback ke kontainer sheet (VoiceOver memilih elemen pertama di dalamnya).
  useOverlayFocus(visible, title ? titleRef : sheetRef, { returnFocusRef })

  // Reduce Motion (audit #2): slide/spring dari tepi layar adalah gerakan
  // besar -> sheet langsung di posisi akhir; backdrop (useOverlayPresence)
  // ikut instan. Drag mengikuti jari tetap diizinkan (dikendalikan user,
  // bukan animasi), hanya settle-nya yang instan.
  const reducedMotion = useReducedMotion()
  const reducedSV = useSharedValue(reducedMotion)
  useEffect(() => {
    reducedSV.value = reducedMotion
  }, [reducedMotion, reducedSV])

  // translateY absolut (px) di UI thread. Mulai di luar layar sampai tinggi terukur.
  const translateY = useSharedValue(windowHeight)
  const sheetHeight = useSharedValue(0)
  const [measured, setMeasured] = useState(false)

  // Buka: spring ke 0 setelah tinggi diketahui. Tutup: spring ke bawah.
  useEffect(() => {
    if (!measured) return
    const target = visible ? 0 : sheetHeight.value
    translateY.value = reducedMotion ? target : withSpring(target, tokens.motion.spring)
  }, [visible, measured, translateY, sheetHeight, reducedMotion])

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height
      if (h === sheetHeight.value) return
      const first = sheetHeight.value === 0
      sheetHeight.value = h
      // Pertama kali: set posisi awal tepat di bawah layar sebelum spring.
      if (first) {
        translateY.value = h
        setMeasured(true)
      }
    },
    [sheetHeight, translateY],
  )

  const requestClose = useCallback(() => onRequestClose?.(), [onRequestClose])
  const canClose = !!onRequestClose

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dragArea !== "none")
        .activeOffsetY(ACTIVE_OFFSET_Y)
        .failOffsetX([-FAIL_OFFSET_X, FAIL_OFFSET_X])
        .onUpdate((e) => {
          // Hanya ke bawah; ke atas ditahan di 0 (tidak ada snap point lebih tinggi)
          translateY.value = Math.max(0, e.translationY)
        })
        .onEnd((e) => {
          const h = sheetHeight.value
          const shouldClose = e.translationY > h * CLOSE_RATIO || e.velocityY > CLOSE_VELOCITY
          if (shouldClose && canClose) {
            if (reducedSV.value) {
              translateY.value = h
              runOnJS(requestClose)()
              return
            }
            translateY.value = withSpring(
              h,
              { ...tokens.motion.spring, velocity: e.velocityY },
              (finished) => {
                if (finished) runOnJS(requestClose)()
              },
            )
          } else {
            translateY.value = reducedSV.value
              ? 0
              : withSpring(0, { ...tokens.motion.spring, velocity: e.velocityY })
          }
        })
        .onFinalize((_e, success) => {
          // Gesture dibatalkan sistem (mis. panggilan masuk): kembali ke posisi buka.
          if (!success) translateY.value = reducedSV.value ? 0 : withSpring(0, tokens.motion.spring)
        }),
    [canClose, dragArea, requestClose, sheetHeight, translateY, reducedSV],
  )

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  if (!mounted) return null

  const hasHeader = !!title || !!description
  const closeVisible = showClose ?? hasHeader
  const Wrapper = avoidKeyboard ? KeyboardAvoiding : View

  const header = (
    <View>
      {showHandle ? (
        <View className="items-center pt-2 pb-1">
          <View className="h-1 w-10 rounded-full bg-border" />
        </View>
      ) : null}

      {hasHeader || closeVisible ? (
        <View className="flex-row items-start gap-2 px-6 pt-3 pb-2">
          <View className="flex-1 gap-1">
            {title ? (
              <Text ref={titleRef} accessibilityRole="header" variant="h3">
                {title}
              </Text>
            ) : null}
            {description ? (
              <Text variant="body" tone="secondary">
                {description}
              </Text>
            ) : null}
          </View>
          {closeVisible ? (
            <IconButton
              icon={X}
              variant="ghost"
              size="sm"
              accessibilityLabel="Tutup"
              onPress={onRequestClose}
              className="-mr-2 -mt-1"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )

  const sheet = (
    <View
      ref={sheetRef}
      onLayout={handleLayout}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel ?? title}
      className="w-full rounded-t-md border border-b-0 border-border bg-surface-elevated"
      style={{ maxHeight: windowHeight * MAX_HEIGHT_RATIO }}
    >
      {/* Handle + header = area drag default */}
      {dragArea === "handle" ? <GestureDetector gesture={pan}>{header}</GestureDetector> : header}

      <View className={cn("shrink px-6 pt-2 pb-4", contentClassName)}>{children}</View>

      {footer ? (
        <View
          className="border-t border-border px-6 pt-4"
          style={{ paddingBottom: insets.bottom + tokens.space[4] }}
        >
          {footer}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </View>
  )

  return (
    <Portal>
      <View pointerEvents="box-none" className="absolute inset-0 z-bottomSheet">
        <Backdrop progress={progress} onPress={dismiss} />

        <Wrapper pointerEvents="box-none" className="flex-1 justify-end items-center">
          <View
            pointerEvents="box-none"
            className="w-full md:max-w-content"
            style={{ maxHeight: windowHeight * MAX_HEIGHT_RATIO }}
          >
            <Animated.View style={sheetStyle}>
              {dragArea === "full" ? <GestureDetector gesture={pan}>{sheet}</GestureDetector> : sheet}
            </Animated.View>
          </View>
        </Wrapper>
      </View>
    </Portal>
  )
}
