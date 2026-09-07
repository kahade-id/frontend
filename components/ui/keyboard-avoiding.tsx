/**
 * Kahade — <KeyboardAvoiding> pembungkus form (§9.2 pendukung).
 *
 * Wrapper `KeyboardAvoidingView` dengan default per-platform yang benar,
 * supaya setiap layar form (login, buat transaksi, KYC) tidak menyalin
 * `Platform.select` yang sama berulang kali:
 *   - iOS     : behavior "padding" — satu-satunya yang mulus dengan ScrollView.
 *   - Android : behavior undefined; `windowSoftInputMode=adjustResize`
 *               (default Expo) sudah me-resize root, dan menambah "height"
 *               di atasnya justru membuat konten melompat dua kali.
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
 */
import type { ReactNode } from "react"
import { KeyboardAvoidingView, Platform, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

export type KeyboardAvoidingProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  /** keyboardVerticalOffset — tinggi header/safe-area di atas area ini */
  offset?: number
  /** Paksa behavior (default: ios "padding", android undefined) */
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
  if (Platform.OS === "web") {
    return (
      <View className={cn("flex-1", className)} {...rest}>
        {children}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={behavior ?? (Platform.OS === "ios" ? "padding" : undefined)}
      keyboardVerticalOffset={offset}
      className={cn("flex-1", className)}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
