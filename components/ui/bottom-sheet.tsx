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
 *   - Animasi buka/tutup memakai `Animated.spring` RN dengan config
 *     tokens.motion.spring (§8 "Bottom sheet: spring"). §15 merekomendasikan
 *     reanimated, tetapi reanimated 4 di project ini belum aktif (peer
 *     `react-native-worklets` belum terpasang). RN Animated + PanResponder
 *     sudah dipakai Slider/PressableScale, jadi ini konsisten & bisa
 *     dimigrasi ke reanimated nanti tanpa mengubah API komponen.
 *   - Sebelum tinggi sheet terukur (onLayout pertama), sheet ditaruh di
 *     translateY = tinggi window supaya tidak "kedip" di posisi akhir lalu
 *     melompat. Spring baru dimulai setelah ukuran diketahui.
 *   - Drag-to-dismiss dengan PanResponder di area handle+header saja
 *     (default), bukan seluruh sheet — kalau seluruh sheet, ScrollView/Slider
 *     di dalam konten akan berebut gesture. `dragArea="full"` tersedia untuk
 *     sheet statis tanpa konten scroll.
 *   - Ambang tutup: geser > 30% tinggi sheet ATAU velocity > 0.5 px/ms.
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
 */
import { X } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Animated,
  PanResponder,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Backdrop, useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { IconButton } from "@/components/ui/icon-button"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Portal } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

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
const CLOSE_VELOCITY = 0.5
const MAX_HEIGHT_RATIO = 0.9

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
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { mounted, progress } = useOverlayPresence(visible, { onHidden })
  const dismiss = dismissOnBackdrop ? onRequestClose : undefined

  useStackingGuard(visible)
  useOverlayDismissKeys(visible, dismiss)

  // translateY absolut (px). Mulai di luar layar sampai tinggi terukur.
  const translateY = useRef(new Animated.Value(windowHeight)).current
  const [sheetHeight, setSheetHeight] = useState(0)
  const sheetHeightRef = useRef(0)

  const springTo = useCallback(
    (to: number, onDone?: () => void) => {
      Animated.spring(translateY, {
        toValue: to,
        ...tokens.motion.spring,
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDone?.())
    },
    [translateY],
  )

  // Buka: spring ke 0 setelah tinggi diketahui. Tutup: spring ke bawah.
  useEffect(() => {
    if (visible) {
      if (sheetHeight > 0) springTo(0)
    } else if (sheetHeight > 0) {
      springTo(sheetHeight)
    }
  }, [visible, sheetHeight, springTo])

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height
      if (h === sheetHeightRef.current) return
      sheetHeightRef.current = h
      // Pertama kali: set posisi awal tepat di bawah layar sebelum spring.
      if (sheetHeight === 0) translateY.setValue(h)
      setSheetHeight(h)
    },
    [sheetHeight, translateY],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          dragArea !== "none" && Math.abs(g.dy) > Math.abs(g.dx) && g.dy > 2,
        onPanResponderMove: (_e, g) => {
          // Hanya ke bawah; ke atas ditahan di 0 (tidak ada snap point lebih tinggi)
          translateY.setValue(Math.max(0, g.dy))
        },
        onPanResponderRelease: (_e, g) => {
          const h = sheetHeightRef.current
          const shouldClose = g.dy > h * CLOSE_RATIO || g.vy > CLOSE_VELOCITY
          if (shouldClose && onRequestClose) {
            // Spring keluar dulu supaya terasa mengikuti jari, lalu minta parent tutup.
            springTo(h, onRequestClose)
          } else {
            springTo(0)
          }
        },
        onPanResponderTerminate: () => springTo(0),
      }),
    [dragArea, onRequestClose, springTo, translateY],
  )

  if (!mounted) return null

  const dragHandlers = dragArea === "none" ? {} : panResponder.panHandlers
  const headerDrag = dragArea === "handle" ? dragHandlers : {}
  const fullDrag = dragArea === "full" ? dragHandlers : {}
  const hasHeader = !!title || !!description
  const closeVisible = showClose ?? hasHeader

  const Wrapper = avoidKeyboard ? KeyboardAvoiding : View

  return (
    <Portal>
      <View pointerEvents="box-none" className="absolute inset-0 z-bottomSheet">
        <Backdrop progress={progress} onPress={dismiss} />

        <Wrapper pointerEvents="box-none" className="flex-1 justify-end items-center">
          {/* Animated.View tidak di-interop NativeWind -> className di pembungkus */}
          <View
            pointerEvents="box-none"
            className="w-full md:max-w-content"
            style={{ maxHeight: windowHeight * MAX_HEIGHT_RATIO }}
          >
            <Animated.View style={{ transform: [{ translateY }] }}>
              <View
                {...fullDrag}
                onLayout={handleLayout}
                accessibilityViewIsModal
                accessibilityLabel={accessibilityLabel ?? title}
                className="w-full rounded-t-md border border-b-0 border-border bg-surface-elevated"
                style={{ maxHeight: windowHeight * MAX_HEIGHT_RATIO }}
              >
                {/* Handle + header = area drag default */}
                <View {...headerDrag}>
                  {showHandle ? (
                    <View className="items-center pt-2 pb-1">
                      <View className="h-1 w-10 rounded-full bg-border" />
                    </View>
                  ) : null}

                  {hasHeader || closeVisible ? (
                    <View className="flex-row items-start gap-2 px-6 pt-3 pb-2">
                      <View className="flex-1 gap-1">
                        {title ? <Text variant="h3">{title}</Text> : null}
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
            </Animated.View>
          </View>
        </Wrapper>
      </View>
    </Portal>
  )
}
