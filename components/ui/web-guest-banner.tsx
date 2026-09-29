/**
 * Kahade — banner tamu web di feed Etalase (U5-017, journey 2026-09-29).
 *
 * Feed showcase terbuka untuk tamu web (WEB_GUEST_TAB_SCREENS). Banner ini
 * ramping & persisten: menjelaskan mode tamu + CTA daftar, dismissible
 * (dismiss disimpan per perangkat). Hanya tampil di web tanpa sesi.
 */
import { useCallback, useEffect, useState } from "react"
import { Platform, View } from "react-native"
import { router } from "expo-router"
import { X } from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"
import { useHasSession } from "@/lib/guest-gate"
import {
  hasDismissedWebGuestBanner,
  markWebGuestBannerDismissed,
} from "@/lib/first-run"

import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"

export function WebGuestBanner() {
  const hasSession = useHasSession()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== "web" || hasSession) {
      setVisible(false)
      return
    }
    let alive = true
    void hasDismissedWebGuestBanner().then((dismissed) => {
      if (alive) setVisible(!dismissed)
    })
    return () => {
      alive = false
    }
  }, [hasSession])

  const dismiss = useCallback(() => {
    void markWebGuestBannerDismissed()
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-2 border-b border-border bg-surface px-4 py-2"
    >
      <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
        Anda menjelajah sebagai tamu —{" "}
        <TextLink onPress={() => router.push(ROUTES.register)}>
          Daftar gratis
        </TextLink>{" "}
        untuk beli &amp; chat
      </Text>
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel="Tutup banner tamu"
        onPress={dismiss}
      />
    </View>
  )
}
