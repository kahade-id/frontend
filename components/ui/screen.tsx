/**
 * Kahade — <Screen> (§4 screen padding & safe area, §11 web).
 *
 * Container standar untuk SETIAP route di app/. Menjamin tiga hal:
 *   1. Safe area (§4): konten interaktif & teks tidak bleed ke notch/status
 *      bar/home indicator. Inset diterapkan sebagai padding dari
 *      `useSafeAreaInsets()` — nilai runtime per-device, jadi ini masuk
 *      pengecualian "tidak bisa di-className" dan dipasang lewat `style`.
 *      Default edges ["top","bottom"] untuk inset vertikal. Inset horizontal
 *      selalu dihormati saat nilainya ada: notch iPhone landscape dapat lebih
 *      lebar dari screen padding 20px; di portrait/web nilainya tetap 0.
 *   2. Screen padding 20px kiri-kanan (`px-5`, tokens.layout.screenPaddingX).
 *      Bisa dimatikan dengan `padded={false}` untuk konten full-bleed
 *      (list dengan divider, peta, gambar) — anak yang butuh padding pakai
 *      `px-5` sendiri atau <Divider inset>.
 *   3. `footer` slot: area sticky di bawah untuk CTA (Button) yang harus
 *      selalu terlihat saat body di-scroll. Dipisah dari body dengan
 *      `border-t border-border` (hierarki border, bukan shadow §6).
 *
 * Kenapa TIDAK ada `md:max-w-content` di sini (non-obvious): cap 520px +
 * center untuk web (§11) sudah diterapkan SEKALI di AppShell (_layout.tsx)
 * membungkus <Stack>. Menaruhnya lagi di Screen akan menghasilkan
 * double-constraint dan border ganda. Screen cukup `w-full`.
 *
 * `scroll` memakai ScrollView dengan `keyboardShouldPersistTaps="handled"`
 * supaya tap pada Button saat keyboard terbuka langsung tereksekusi (bukan
 * hanya menutup keyboard). Untuk layar form, bungkus body dengan
 * KeyboardAvoidingView di level route bila perlu — tidak dipaksa di sini
 * karena perilakunya berbeda per header/tab bar.
 *
 * Background: `bg-background` default. Layar yang dominan card memakai
 * `surface` agar card putih (surface-elevated) terlihat "naik" (§6).
 *
 * Aksesibilitas (UX-A11Y-003): saat mount (navigasi ke layar baru), fokus
 * screen reader dipindahkan ke konten layar setelah interaksi selesai
 * (InteractionManager) — pola yang sama dengan `useOverlayFocus` untuk
 * overlay. Di iOS VoiceOver memilih elemen pertama di dalam container bila
 * node target bukan elemen a11y; di Android target adalah ScrollView/View
 * konten. Matikan per-layar dengan `focusOnMount={false}` bila layar
 * di-render di dalam overlay yang sudah mengelola fokus sendiri.
 */
import { createContext, useEffect, useRef, type ReactNode, type Ref } from "react"
import { InteractionManager, ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native"
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context"

import { FooterBar } from "@/components/ui/footer-bar"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { focusAccessibility } from "@/lib/use-overlay-focus"
import { cn } from "@/lib/cn"

export const ScreenInsetsContext = createContext({ top: false })

export type ScreenBackground = "background" | "surface"

export type ScreenProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  /** Body dapat di-scroll (ScrollView). Default false = View flex-1. */
  scroll?: boolean
  /**
   * Resize form body and sticky actions above the iOS keyboard.
   *
   * CHT-014: offset default 0 — BENAR untuk semua pemakai saat ini karena
   * <Header> dirender DI DALAM KeyboardAvoidingView, bukan di atasnya
   * (klaim lama "offset = Header 56 + inset.top" tidak pernah
   * diimplementasikan dan menyesatkan). Kalau suatu layar menaruh header
   * native DI ATAS <Screen keyboardAvoiding>, teruskan offset eksplisit
   * lewat <KeyboardAvoiding offset={...}> langsung — prop ini tidak
   * meneruskannya.
   */
  keyboardAvoiding?: boolean
  /** Padding horizontal 20px pada body. Default true. */
  padded?: boolean
  /** Sisi safe area yang di-padding. Default top + bottom. */
  edges?: Edge[]
  background?: ScreenBackground
  /** Area sticky di bawah body — biasanya Button CTA */
  footer?: ReactNode
  /** Dipakai saat scroll=true; className konten ScrollView */
  contentContainerClassName?: string
  scrollViewProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle">
  className?: string
  /**
   * UX-A11Y-003: pindahkan fokus screen reader ke konten layar saat mount.
   * Default true. Set false bila layar di-render di dalam overlay yang
   * sudah mengelola fokus (Modal/BottomSheet via useOverlayFocus).
   */
  focusOnMount?: boolean
}

const bgClass: Record<ScreenBackground, string> = {
  background: "bg-background",
  surface: "bg-surface",
}

export function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  padded = true,
  edges = ["top", "bottom"],
  background = "background",
  footer,
  contentContainerClassName,
  scrollViewProps,
  className,
  style,
  focusOnMount = true,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const padTop = edges.includes("top") ? insets.top : 0
  const padBottom = edges.includes("bottom") ? insets.bottom : 0
  // Inset horizontal selalu dihormati bila ada. Pada iPhone landscape notch
  // dapat memakan ~59pt—jauh lebih besar dari padding konten 20px. Menunggu
  // setiap screen menambahkan edge kiri/kanan membuat tombol dan input dapat
  // tertutup; pada portrait/web nilainya nol sehingga tidak mengubah layout.
  const padLeft = insets.left
  const padRight = insets.right

  const bodyPad = padded && "px-5"

  const Body = keyboardAvoiding ? KeyboardAvoiding : View

  // UX-A11Y-003: navigasi antar-layar memindahkan fokus screen reader ke
  // konten layar yang baru di-mount. Ref ke ScrollView/View konten
  // (host component), bukan ke Body — KeyboardAvoiding tidak meneruskan ref.
  const contentRef = useRef<ScrollView | View | null>(null)
  useEffect(() => {
    if (!focusOnMount) return
    const task = InteractionManager.runAfterInteractions(() => {
      focusAccessibility(contentRef.current)
    })
    return () => task.cancel()
  }, [focusOnMount])

  return (
    <ScreenInsetsContext.Provider value={{ top: edges.includes("top") }}>
      <Body
        className={cn("w-full flex-1", bgClass[background], className)}
        // Inset safe area adalah nilai runtime -> style, bukan className.
        // Bottom inset dipindah ke footer bila footer ada, supaya CTA yang
        // menempel di bawah tidak tertutup home indicator.
        style={[
          { paddingTop: padTop, paddingLeft: padLeft, paddingRight: padRight },
          !footer && { paddingBottom: padBottom },
          style,
        ]}
        {...rest}
      >
        {scroll ? (
          <ScrollView
            ref={contentRef as Ref<ScrollView>}
            collapsable={false}
            className="flex-1"
            contentContainerClassName={cn("grow", bodyPad, contentContainerClassName)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            {...scrollViewProps}
          >
            {children}
          </ScrollView>
        ) : (
          <View ref={contentRef as Ref<View>} collapsable={false} className={cn("flex-1", bodyPad)}>{children}</View>
        )}

        {footer ? <FooterBar>{footer}</FooterBar> : null}
      </Body>
    </ScreenInsetsContext.Provider>
  )
}
