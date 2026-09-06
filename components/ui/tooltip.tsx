/**
 * Kahade — <Tooltip> (§9.24).
 *
 * Popover kecil yang muncul saat trigger DI-TAP (bukan hover — mobile-first,
 * §11 tanpa hover). Default trigger: ikon Info "ⓘ" (IconButton ghost sm).
 * Dismiss: tap di mana pun di luar tooltip.
 *
 * Alur: tap trigger -> `measureInWindow` posisi trigger -> render via
 * <Portal> sebuah layer transparan full-screen (Backdrop transparent, untuk
 * menangkap tap luar) + kotak tooltip di posisi absolut dekat trigger.
 *
 * Keputusan non-obvious:
 *   - Posisi dihitung dua langkah: kotak dirender dulu dengan opacity 0
 *     untuk diukur (onLayout), baru diposisikan & di-fade-in. Tanpa ini
 *     tooltip "melompat" satu frame karena lebar/tinggi teks belum tahu.
 *   - Placement "auto": di atas trigger bila muat (ruang >= tinggi tooltip +
 *     gap), jika tidak di bawah. Horizontal di-center ke trigger lalu
 *     di-clamp ke dalam window dengan margin space.4 agar tidak terpotong.
 *   - Tanpa panah/caret: bentuk flat & radius `rounded-xs` (§9.24) sudah
 *     cukup mengaitkan ke trigger lewat jarak 4px; panah menambah bentuk
 *     non-rect yang tidak ada di kosakata visual sistem ini.
 *   - Lebar maks 260px: cukup untuk 2–3 baris caption; teks lebih panjang
 *     seharusnya jadi helper text / halaman bantuan, bukan tooltip.
 *   - Koordinat memakai `measureInWindow` sehingga <PortalHost> HARUS
 *     full-window (absolute inset-0 di root, di luar wrapper `md:max-w-content`)
 *     — kalau host di-offset, posisi akan meleset sebesar offset itu.
 *   - `z-modal` (60): tooltip boleh muncul di atas BottomSheet (mis. info di
 *     dalam sheet filter) dan tetap di bawah Banner (70).
 */
import { Info } from "phosphor-react-native"
import { useCallback, useRef, useState, type ReactNode } from "react"
import {
  Animated,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type View as RNView,
} from "react-native"

import { Backdrop, useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { IconButton } from "@/components/ui/icon-button"
import { Portal } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type TooltipPlacement = "auto" | "top" | "bottom"

export type TooltipProps = {
  /** Isi tooltip — string dirender sebagai Caption; node untuk konten kaya */
  content: string | ReactNode
  /** Trigger custom; default IconButton Info. Dibungkus Pressable oleh Tooltip. */
  children?: ReactNode
  placement?: TooltipPlacement
  /** Label a11y trigger default (default "Info") */
  accessibilityLabel?: string
  /** Controlled (opsional) */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

type Rect = { x: number; y: number; width: number; height: number }
type Size = { width: number; height: number }

const MAX_WIDTH = 260
const MAX_WIDTH_MD = 320 // audit #113: di layar lebar 520, 260 terasa sempit (50% width)
const GAP = tokens.space[1]
const EDGE = tokens.space[4]

export function Tooltip({
  content,
  children,
  placement = "auto",
  accessibilityLabel = "Info",
  open: openProp,
  onOpenChange,
  className,
}: TooltipProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = useCallback(
    (v: boolean) => {
      setOpenState(v)
      onOpenChange?.(v)
    },
    [onOpenChange],
  )

  const triggerRef = useRef<RNView>(null)
  const [anchor, setAnchor] = useState<Rect | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const { width: winW, height: winH } = useWindowDimensions()

  const { mounted, progress } = useOverlayPresence(open && size != null, {
    onHidden: () => setSize(null),
  })
  const close = useCallback(() => setOpen(false), [setOpen])
  useOverlayDismissKeys(open, close)

  const handleTrigger = useCallback(() => {
    if (open) {
      close()
      return
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height })
      setOpen(true)
    })
  }, [open, close, setOpen])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    )
  }, [])

  // --- Hitung posisi ------------------------------------------------------
  let top = 0
  let left = 0
  let resolved: "top" | "bottom" = "top"
  if (anchor && size) {
    const fitsAbove = anchor.y - GAP - size.height >= EDGE
    resolved =
      placement === "auto" ? (fitsAbove ? "top" : "bottom") : placement
    top =
      resolved === "top"
        ? anchor.y - GAP - size.height
        : anchor.y + anchor.height + GAP
    // clamp vertikal (jaga-jaga trigger di tepi bawah + placement paksa)
    top = Math.min(Math.max(EDGE, top), winH - EDGE - size.height)

    const centered = anchor.x + anchor.width / 2 - size.width / 2
    left = Math.min(Math.max(EDGE, centered), winW - EDGE - size.width)
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [resolved === "top" ? GAP : -GAP, 0],
  })

  const showLayer = open || mounted
  const measuring = open && size == null

  return (
    <>
      <View accessible={false} ref={triggerRef} collapsable={false} className="self-start">
        {children ? (
          <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ expanded: open }}
            onPress={handleTrigger}
          >
            {children}
          </Pressable>
        ) : (
          <IconButton
            icon={Info}
            variant="ghost"
            size="sm"
            active={open}
            accessibilityLabel={accessibilityLabel}
            onPress={handleTrigger}
          />
        )}
      </View>

      {showLayer && anchor ? (
        <Portal>
          <View pointerEvents="box-none" className="absolute inset-0 z-modal">
            <Backdrop progress={progress} onPress={close} transparent accessibilityLabel="Tutup info" />

            {/* Fase ukur: posisi sementara di tepi kiri-atas, opacity 0 */}
            <View
              pointerEvents={measuring ? "none" : "box-none"}
              style={
                measuring
                  ? { position: "absolute", top: EDGE, left: EDGE, opacity: 0 }
                  : { position: "absolute", top, left }
              }
            >
              <Animated.View
                style={measuring ? undefined : { opacity: progress, transform: [{ translateY }] }}
              >
                <View
                  onLayout={handleLayout}
                  accessibilityRole="text"
                  accessibilityLiveRegion="polite"
                  style={{ maxWidth: MAX_WIDTH }}
                  className={cn(
                    "rounded-xs border border-border bg-surface-elevated px-3 py-2",
                    className,
                  )}
                >
                  {typeof content === "string" ? (
                    <Text variant="caption" tone="primary">
                      {content}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              </Animated.View>
            </View>
          </View>
        </Portal>
      ) : null}
    </>
  )
}