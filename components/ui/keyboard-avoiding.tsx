/**
 * Kahade — <KeyboardAvoiding> pembungkus form (§9.2 pendukung).
 *
 * Wrapper `KeyboardAvoidingView` dengan default per-platform yang benar,
 * supaya setiap layar form (login, buat transaksi, KYC) tidak menyalin
 * `Platform.select` yang sama berulang kali:
 *   - iOS     : behavior "padding" — satu-satunya yang mulus dengan ScrollView.
 *   - Android : behavior "padding" — tinggi keyboard diukur dari event dan
 *               ditambahkan sebagai padding bawah. (2026-10-02: sebelumnya
 *               undefined mengandalkan adjustResize, terbukti tidak mengangkat
 *               footer di device user.)
 *   - Web     : tidak ada keyboard virtual yang menutupi viewport dengan cara
 *               yang sama; render <View> polos.
 *
 * `offset` = jarak header di atas (tinggi Header + safe area) yang harus
 * dihitung KeyboardAvoidingView agar padding-nya tepat. Nilai ini runtime
 * (tergantung inset device), jadi dilewatkan sebagai angka, bukan className.
 *
 * Tidak dimasukkan ke <Screen> (non-obvious): perilakunya bergantung pada
 * ada/tidaknya header native & tab bar di route tersebut, sehingga lebih
 * aman dipasang eksplisit oleh layar yang memang berisi input.
 *
 * PERF-NOTE (audit 2026-09-30 TIM 7): `LayoutAnimation.configureNext`
 * bersifat global — memicu layout ulang seluruh subtree yang berubah, bukan
 * hanya view ini. Kandidat migrasi: Reanimated `useAnimatedKeyboard` yang
 * granular per-view. Belum dimigrasi karena perilaku keyboard sangat
 * fragile (CHT-005) — migrasi butuh pengujian device iOS + Android.
 */
import { useEffect, type ReactNode } from "react"
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  UIManager,
  View,
  type ViewProps,
} from "react-native"

import { cn } from "@/lib/cn"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export type KeyboardAvoidingProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  /** keyboardVerticalOffset — tinggi header/safe-area di atas area ini */
  offset?: number
  /**
   * Paksa behavior (default: ios "padding", android "padding").
   *
   * 2026-10-02 (fix keyboard menutupi input): Android sebelumnya SENGAJA
   * undefined dengan asumsi `windowSoftInputMode=adjustResize` (default Expo)
   * me-resize root. Terbukti di device user: input bawah TETAP tertutup —
   * adjustResize tidak mengangkat footer dengan benar (kemungkinan interaksi
   * dengan safe-area/stack navigator di SDK 54). Sekarang pakai "padding":
   * tinggi keyboard diukur dari event dan ditambahkan sebagai padding bawah
   * secara manual — deterministik, tidak tergantung windowSoftInputMode.
   * Kalau suatu layar mengalami double-jump (adjustResize + padding),
   * teruskan behavior={undefined} eksplisit untuk layar itu saja.
   */
  behavior?: "padding" | "height" | "position"
  className?: string
}

export function KeyboardAvoiding({
  children,
  offset = 0,
  behavior,
  className,
  ...rest
}: KeyboardAvoidingProps) {
  useEffect(() => {
    if (Platform.OS === "web") return
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const showSub = Keyboard.addListener(showEvent, (e) => {
      LayoutAnimation.configureNext({
        duration: e?.duration || 250,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      })
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      LayoutAnimation.configureNext({
        duration: e?.duration || 200,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      })
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  if (Platform.OS === "web") {
    return (
      <View className={cn("flex-1", className)} {...rest}>
        {children}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      // 2026-10-02: Android = "padding" (lihat docblock di atas) — behavior
      // undefined mengandalkan adjustResize yang terbukti tidak mengangkat
      // footer di device user.
      behavior={behavior ?? "padding"}
      keyboardVerticalOffset={offset}
      className={cn("flex-1", className)}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
