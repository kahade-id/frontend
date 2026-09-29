/**
 * Kahade — <CoachMark> (§9.24, varian "sekali saja").
 *
 * Tooltip pengenal kecil untuk elemen UI BARU yang tampil OTOMATIS saat user
 * pertama kali melihatnya setelah update — bukan saat di-tap seperti
 * <Tooltip> biasa:
 *
 *   - "create": tombol (+) di header Etalase → "Ketuk + untuk buat karya"
 *   - "qr"    : ikon QR di tengah bottom navbar → "Ketuk untuk pindai QR"
 *
 * Setelah tampil/ditutup SEKALI, flag "sudah dilihat" disimpan persisten
 * (lib/coach-mark.ts → SecureStore, pola lib/onboarding.ts) dan tooltip
 * tidak pernah tampil lagi — termasuk setelah logout (level perangkat).
 *
 * Mekanika meniru <Tooltip> (bukan mewarisinya — trigger Tooltip membuka
 * saat di-tap, sedangkan coach mark membuka sendiri):
 *   - Posisi: `measureInWindow` pada `targetRef`, dirender via <Portal> agar
 *     keluar dari ScrollView/`overflow-hidden` parent.
 *   - Ukur dua fase: kotak dirender dulu dengan opacity 0 untuk diukur
 *     (onLayout), baru diposisikan & di-fade-in — tanpa ini tooltip
 *     "melompat" satu frame (catatan yang sama di tooltip.tsx).
 *   - Dismiss: ketuk di mana pun di luar bubble (Backdrop transparent),
 *     tombol Back (Android) / Escape (web), atau ketuk bubble-nya sendiri.
 *     Setiap jalur dismiss MENANDAI flag seen — "dilihat" = pernah tampil
 *     lalu ditutup, sesuai definisi tugas.
 *   - Reduced motion: `useOverlayPresence` membuat tampil/hilang instan
 *     (durasi 0) — tidak ada animasi geser saat preferensi itu aktif.
 *
 * Batasan: bila target tidak terukur (ref null / layout 0 — mis. layar
 * ter-unmount sebelum delay habis), tooltip tidak tampil dan flag TIDAK
 * ditandai, sehingga kesempatan tampil tidak hilang sia-sia.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import {
  Animated,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type View as RNView,
} from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Backdrop, useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { Portal } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { elevationStyle } from "@/lib/elevation"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { useReducedMotion, motionDuration } from "@/lib/use-reduced-motion"
import { hasSeenCoachMark, markCoachMarkSeen, type CoachMarkId } from "@/lib/coach-mark"

export type CoachMarkPlacement = "auto" | "top" | "bottom"

/** Re-export id flag (definisi di lib/coach-mark.ts) untuk pemakai komponen. */
export type { CoachMarkId }

export type CoachMarkProps = {
  /**
   * Elemen yang diperkenalkan: "create" (tombol +), "qr" (ikon QR), atau
   * "feed-buy" (U5-004: orientasi beli pada kartu feed pertama).
   */
  id: CoachMarkId
  /** Ref ke view target — diukur via measureInWindow untuk posisi bubble. */
  targetRef: RefObject<RNView | null>
  /** Isi bubble. */
  message: string
  /** Default "auto": di bawah bila muat, di atas bila tidak. */
  placement?: CoachMarkPlacement
  /** Jeda sebelum tampil agar layout target stabil (default 700ms). */
  delayMs?: number
  className?: string
}

type Rect = { x: number; y: number; width: number; height: number }
type Size = { width: number; height: number }

const MAX_WIDTH = 260
const GAP = tokens.space[1]
const EDGE = tokens.space[4]
const DEFAULT_DELAY_MS = 700

export function CoachMark({
  id,
  targetRef,
  message,
  placement = "auto",
  delayMs = DEFAULT_DELAY_MS,
  className,
}: CoachMarkProps) {
  const { mode } = useTheme()
  const reducedMotion = useReducedMotion()
  const [eligible, setEligible] = useState(false)
  const [anchor, setAnchor] = useState<Rect | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  /** false lagi saat dismiss — `mounted` menjaga exit animation tetap jalan. */
  const [open, setOpen] = useState(false)
  const dismissed = useRef(false)
  const { width: winW, height: winH } = useWindowDimensions()

  // 1. Cek flag sekali saat mount — sudah pernah tampil = tidak render apa-apa.
  useEffect(() => {
    let alive = true
    void hasSeenCoachMark(id).then((seen) => {
      if (alive && !seen) setEligible(true)
    })
    return () => {
      alive = false
    }
  }, [id])

  // 2. Setelah jeda, ukur target; gagal ukur = batal tampil (flag tidak ditandai).
  useEffect(() => {
    if (!eligible || dismissed.current) return
    const t = setTimeout(
      () => {
        targetRef.current?.measureInWindow((x, y, width, height) => {
          if (dismissed.current) return
          if (width > 0 && height > 0) {
            setAnchor({ x, y, width, height })
            setOpen(true)
          }
        })
      },
      motionDuration(reducedMotion, delayMs),
    )
    return () => clearTimeout(t)
  }, [eligible, delayMs, reducedMotion, targetRef])

  const { mounted, progress } = useOverlayPresence(open && size != null, {
    onHidden: () => setSize(null),
  })

  const dismiss = useCallback(() => {
    if (dismissed.current) return
    dismissed.current = true
    setOpen(false)
    // "Dilihat" = pernah tampil lalu ditutup — tandai di semua jalur tutup.
    void markCoachMarkSeen(id)
  }, [id])

  useOverlayDismissKeys(open, dismiss)

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    )
  }, [])

  // --- Hitung posisi (pola yang sama dengan tooltip.tsx) -------------------
  let top = 0
  let left = 0
  let resolved: "top" | "bottom" = "bottom"
  if (anchor && size) {
    const fitsBelow = anchor.y + anchor.height + GAP + size.height <= winH - EDGE
    resolved = placement === "auto" ? (fitsBelow ? "bottom" : "top") : placement
    top =
      resolved === "bottom"
        ? anchor.y + anchor.height + GAP
        : anchor.y - GAP - size.height
    top = Math.min(Math.max(EDGE, top), winH - EDGE - size.height)

    const centered = anchor.x + anchor.width / 2 - size.width / 2
    left = Math.min(Math.max(EDGE, centered), winW - EDGE - size.width)
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [resolved === "bottom" ? -GAP : GAP, 0],
  })

  const showLayer = open || mounted
  const measuring = open && size == null

  // `mounted` tetap true selama exit animation — jangan unmount mendadak.
  if (!eligible || (anchor == null && !mounted)) return null

  return (
    <Portal>
      <View style={{ pointerEvents: "box-none" }} className="absolute inset-0 z-modal">
        {showLayer ? (
          <Backdrop
            progress={progress}
            onPress={dismiss}
            transparent
            accessibilityLabel={translate("Tutup pengenal")}
          />
        ) : null}

        {showLayer ? (
          <View
            style={[
              { pointerEvents: measuring ? "none" : "box-none", zIndex: 1 },
              measuring
                ? { position: "absolute", top: EDGE, left: EDGE, opacity: 0 }
                : { position: "absolute", top, left },
            ]}
          >
            <Animated.View
              style={measuring ? undefined : { opacity: progress, transform: [{ translateY }] }}
            >
              {/* Ketuk bubble = tutup (affordance eksplisit "bisa ditutup
                  dengan ketuk"; tap di luar juga menutup via Backdrop). */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate("Tutup pengenal")}
                accessibilityHint={message}
                onPress={dismiss}
              >
                <View
                  onLayout={handleLayout}
                  accessibilityRole="text"
                  accessibilityLiveRegion="polite"
                  style={[
                    { maxWidth: MAX_WIDTH },
                    elevationStyle("low", mode),
                  ]}
                  className={cn(
                    "rounded-xs border border-border bg-surface-elevated px-3 py-2",
                    className,
                  )}
                >
                  <Text variant="caption" tone="primary">
                    {message}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </Portal>
  )
}
