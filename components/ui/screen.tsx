/**
 * Kahade — <Screen> (§4 screen padding & safe area, §11 web).
 *
 * Container standar untuk SETIAP route di app/. Menjamin tiga hal:
 *   1. Safe area (§4): konten interaktif & teks tidak bleed ke notch/status
 *      bar/home indicator. Inset diterapkan sebagai padding dari
 *      `useSafeAreaInsets()` — nilai runtime per-device, jadi ini masuk
 *      pengecualian "tidak bisa di-className" dan dipasang lewat `style`.
 *      Default edges ["top","bottom"]; kiri-kanan diabaikan karena screen
 *      padding 24px sudah lebih besar dari inset landscape umum, dan di web
 *      insetnya 0.
 *   2. Screen padding 24px kiri-kanan (`px-6`, tokens.layout.screenPaddingX).
 *      Bisa dimatikan dengan `padded={false}` untuk konten full-bleed
 *      (list dengan divider, peta, gambar) — anak yang butuh padding pakai
 *      `px-6` sendiri atau <Divider inset>.
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
 */
import { createContext, type ReactNode } from "react"
import { ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native"
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context"

import { FooterBar } from "@/components/ui/footer-bar"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { cn } from "@/lib/cn"

export const ScreenInsetsContext = createContext({ top: false })

export type ScreenBackground = "background" | "surface"

export type ScreenProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  /** Body dapat di-scroll (ScrollView). Default false = View flex-1. */
  scroll?: boolean
  /** Resize form body and sticky actions above the iOS keyboard. */
  keyboardAvoiding?: boolean
  /** Padding horizontal 24px pada body. Default true. */
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
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const padTop = edges.includes("top") ? insets.top : 0
  const padBottom = edges.includes("bottom") ? insets.bottom : 0
  const padLeft = edges.includes("left") ? insets.left : 0
  const padRight = edges.includes("right") ? insets.right : 0

  const bodyPad = padded && "px-6"

  const Body = keyboardAvoiding ? KeyboardAvoiding : View

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
            className="flex-1"
            contentContainerClassName={cn("grow", bodyPad, contentContainerClassName)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            {...scrollViewProps}
          >
            {children}
          </ScrollView>
        ) : (
          <View className={cn("flex-1", bodyPad)}>{children}</View>
        )}

        {footer ? <FooterBar>{footer}</FooterBar> : null}
      </Body>
    </ScreenInsetsContext.Provider>
  )
}
