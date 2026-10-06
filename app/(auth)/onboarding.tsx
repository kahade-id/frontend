/**
 * Kahade — onboarding sederhana: logo + tagline + dua tombol. Tanpa carousel.
 * "Daftar" membuka wizard nomor HP; "Masuk" membuka layar dengan pemilih
 * metode yang sudah terlihat (bukan bottom sheet).
 */

import { useCallback } from "react"
import { useRouter } from "expo-router"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { haptic } from "@/lib/haptics"
import { markOnboardingSeen } from "@/lib/onboarding"
import { ROUTES } from "@/lib/routes"

export default function OnboardingScreen() {
  const router = useRouter()

  const handleRegister = useCallback(async () => {
    haptic("select")
    await markOnboardingSeen()
    router.replace(ROUTES.register)
  }, [router])

  const handleLogin = useCallback(async () => {
    haptic("light")
    await markOnboardingSeen()
    router.replace(ROUTES.login)
  }, [router])

  return (
    <Screen>
      <VStack gap={8} className="flex-1 items-center justify-center px-6">
        <VStack gap={3} className="items-center">
          <Logo variant="lockup" size="lg" />
          <Text variant="body" tone="secondary" className="text-center">
            Jual beli aman via Kahade.
          </Text>
        </VStack>

        <VStack gap={3} className="w-full">
          <Button onPress={() => void handleRegister()}>Daftar</Button>
          <Button variant="secondary" onPress={() => void handleLogin()}>
            Masuk
          </Button>
        </VStack>
      </VStack>
    </Screen>
  )
}
