/**
 * Kahade — Onboarding: pilihan Daftar / Masuk.
 *
 * Desain Apple-clean: logo + tagline + dua tombol. Tanpa carousel.
 * - "Daftar" → halaman pendaftaran.
 * - "Masuk" → bottomsheet pilihan metode login (WhatsApp, Email,
 *   Username, Google, Apple).
 */

import { useCallback, useState } from "react"
import { useRouter } from "expo-router"

import { LoginMethodSheet, type LoginMethod } from "@/components/auth/login-method-sheet"
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
  const [sheetVisible, setSheetVisible] = useState(false)

  const handleRegister = useCallback(async () => {
    haptic("select")
    await markOnboardingSeen()
    router.replace(ROUTES.register)
  }, [router])

  const handleLoginPress = useCallback(() => {
    haptic("light")
    setSheetVisible(true)
  }, [])

  const handleMethodSelect = useCallback(
    async (method: LoginMethod) => {
      await markOnboardingSeen()
      // Google/Apple langsung ke login dengan method sosial;
      // phone/email/username ke login dengan method yang dipilih.
      router.replace({
        pathname: "/login",
        params: { method },
      } as unknown as Parameters<typeof router.replace>[0])
    },
    [router],
  )

  return (
    <Screen>
      <VStack gap={8} className="flex-1 items-center justify-center px-6">
        {/* Brand */}
        <VStack gap={3} className="items-center">
          <Logo variant="lockup" size="lg" />
          <Text variant="body" tone="secondary" className="text-center">
            Jual beli aman via Kahade.
          </Text>
        </VStack>

        {/* Pilihan */}
        <VStack gap={3} className="w-full">
          <Button onPress={handleRegister}>Daftar</Button>
          <Button variant="secondary" onPress={handleLoginPress}>
            Masuk
          </Button>
        </VStack>
      </VStack>

      {/* Bottomsheet metode login */}
      <LoginMethodSheet
        visible={sheetVisible}
        onRequestClose={() => setSheetVisible(false)}
        onSelect={handleMethodSelect}
      />
    </Screen>
  )
}
