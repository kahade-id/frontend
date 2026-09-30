/**
 * Kahade — landing minimal (web saja).
 *
 * Keputusan user 2026-09-30: landing page marketing full (13 section)
 * DIHAPUS — nanti jadi project terpisah. kahade.id untuk sekarang hanya:
 * landing minimal + deeplink (ditangani expo-router).
 *
 * Desain mengikuti preferensi Apple-clean: hanya yang penting —
 * logo, satu baris tagline, satu tombol ke aplikasi.
 */
import { Platform, View } from "react-native"
import { Redirect, router, type Href } from "expo-router"

import { Logo } from "@/components/ui/logo"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/routes"

export default function Landing() {
  if (Platform.OS !== "web") return <Redirect href="/" />

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="items-center gap-5 max-w-sm w-full">
        <Logo variant="lockup" size="lg" />
        <Text variant="body" tone="secondary" className="text-center">
          Jual beli online dengan escrow yang aman.
        </Text>
        <Button
          variant="primary"
          onPress={() => router.replace(ROUTES.home as Href)}
          containerClassName="w-full mt-2"
        >
          Buka Aplikasi
        </Button>
      </View>
      <Text variant="caption" tone="tertiary" className="absolute bottom-8">
        © 2026 PT Kawal Hak Dengan Aman
      </Text>
    </View>
  )
}
