/**
 * Kahade — <ScreenCaptureGuard> (SEC-404).
 *
 * Proteksi screen-capture iOS untuk layar sensitif (PIN/OTP/saldo).
 * Android TIDAK disentuh: FLAG_SECURE sudah aktif app-wide via
 * plugins/with-flag-secure.js (screenshot, recording, dan thumbnail
 * app-switcher terblokir di sana).
 *
 * Selama guard terpasang, di iOS:
 *  1. `preventScreenCaptureAsync` — mencegah screenshot (iOS 13+) dan screen
 *     recording (iOS 11+). Di Android panggilan ini no-op karena FLAG_SECURE.
 *  2. `enableAppSwitcherProtectionAsync` — overlay blur saat app tidak fokus
 *     (app switcher / snapshot background), pola umum aplikasi bank.
 *  3. Listener screenshot → overlay opaque menutupi konten sensitif sampai
 *     user menutupnya. Lapis cadangan untuk iOS lama di mana pencegahan (1)
 *     tidak tersedia.
 *
 * `expo-screen-capture` dimuat dinamis dalam try/catch: bila modul native
 * tidak ada (binary lama, Expo Go), guard menjadi no-op alih-alih crash.
 *
 * Tidak mengubah tampilan UI selain proteksi ini.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Platform, StyleSheet, View } from "react-native"
import { EyeSlash } from "phosphor-react-native"
import type { EventSubscription } from "expo-modules-core"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"

type ScreenCaptureModule = typeof import("expo-screen-capture")

async function loadScreenCapture(): Promise<ScreenCaptureModule | null> {
  try {
    return await import("expo-screen-capture")
  } catch {
    return null
  }
}

let guardSequence = 0
let appSwitcherRefCount = 0

function enableAppSwitcherProtection(sc: ScreenCaptureModule): void {
  if (Platform.OS !== "ios") return
  appSwitcherRefCount += 1
  if (appSwitcherRefCount === 1) {
    sc.enableAppSwitcherProtectionAsync(1).catch(() => {})
  }
}

function disableAppSwitcherProtection(sc: ScreenCaptureModule): void {
  if (Platform.OS !== "ios") return
  appSwitcherRefCount = Math.max(0, appSwitcherRefCount - 1)
  if (appSwitcherRefCount === 0) {
    sc.disableAppSwitcherProtectionAsync().catch(() => {})
  }
}

function CaptureDetectedOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      className="z-50 items-center justify-center gap-4 bg-background px-8"
      accessibilityRole="alert"
      accessibilityLabel={translate("Konten sensitif disembunyikan")}
    >
      <Icon icon={EyeSlash} size="xl" tone="default" />
      <Text variant="h3" tone="primary" className="text-center">
        {translate("Layar disembunyikan")}
      </Text>
      <Text variant="body" tone="secondary" className="text-center">
        {translate(
          "Tangkapan layar terdeteksi. Konten sensitif disembunyikan demi keamanan akun Anda.",
        )}
      </Text>
      <Button onPress={onDismiss}>{translate("Tutup")}</Button>
    </View>
  )
}

export function ScreenCaptureGuard({ children }: { children: ReactNode }) {
  const [captured, setCaptured] = useState(false)
  const keyRef = useRef<string | null>(null)
  if (keyRef.current === null) {
    guardSequence += 1
    keyRef.current = `kahade-sensitive-${guardSequence}`
  }

  useEffect(() => {
    let cancelled = false
    let screenshotSub: EventSubscription | undefined
    let sc: ScreenCaptureModule | null = null
    const key = keyRef.current as string

    loadScreenCapture().then((mod) => {
      if (cancelled || !mod) return
      sc = mod
      // 1. Cegah screenshot & screen recording selama layar tampil.
      mod.preventScreenCaptureAsync(key).catch(() => {})
      // 2. Blur saat app-switcher / background (iOS).
      enableAppSwitcherProtection(mod)
      // 3. Cadangan: bila screenshot tetap terjadi, tutupi konten.
      screenshotSub = mod.addScreenshotListener(() => setCaptured(true))
    })

    return () => {
      cancelled = true
      screenshotSub?.remove()
      if (sc) {
        sc.allowScreenCaptureAsync(key).catch(() => {})
        disableAppSwitcherProtection(sc)
      }
    }
  }, [])

  return (
    <>
      {children}
      {captured ? <CaptureDetectedOverlay onDismiss={() => setCaptured(false)} /> : null}
    </>
  )
}
