/**
 * Kahade — <SafeAreaSpacer> (§4 safe area).
 *
 * View kosong setinggi inset safe-area satu sisi. Untuk komponen yang hidup
 * di LUAR <Screen> (yang sudah menangani inset sendiri): BottomSheet, footer
 * sticky modal, Toast di atas layar, Tab Bar kustom.
 *
 * `min` = tinggi minimum dari skala spacing (§4). Alasan (non-obvious): di
 * web dan Android tanpa gesture nav inset bawah = 0, sehingga CTA di dasar
 * sheet akan menempel ke tepi. `min={4}` menjamin ada napas 16px di semua
 * platform, dan di iPhone dengan home indicator memakai inset asli (34px)
 * karena lebih besar. Nilai runtime -> `style` (pengecualian className).
 *
 * Bukan padding di parent karena sheet/footer sering punya border-t sendiri;
 * spacer sebagai anak terakhir lebih mudah dikontrol daripada padding
 * kondisional per platform.
 */
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { space } from "@/lib/tokens"

export type SafeAreaSpacerProps = Omit<ViewProps, "children"> & {
  edge?: "top" | "bottom"
  /** Tinggi minimum (key skala spacing). Default 0. */
  min?: keyof typeof space
  className?: string
}

export function SafeAreaSpacer({
  edge = "bottom",
  min = 0,
  className,
  style,
  ...rest
}: SafeAreaSpacerProps) {
  const insets = useSafeAreaInsets()
  const inset = edge === "top" ? insets.top : insets.bottom
  const height = Math.max(inset, space[min])

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
      style={[{ height }, style]}
      {...rest}
    />
  )
}
