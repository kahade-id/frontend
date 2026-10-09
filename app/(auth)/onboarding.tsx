/**
 * Kahade — onboarding: slide intro (screen #1 alur auth) + dua CTA.
 *
 * REGRESI YANG DIPERBAIKI (overhaul auth 2026-10-10):
 *   Layar ini sempat ditulis ulang menjadi "logo + tagline + dua tombol"
 *   sementara <OnboardingCarousel> dan ONBOARDING_SLIDES tetap hidup di
 *   components/onboarding/ TANPA satu pun importer. Akibatnya slide intro
 *   tidak pernah tampil di platform mana pun — bukan masalah flag, bukan
 *   masalah navigasi: `app/index.tsx` tetap mengirim user baru ke
 *   `/onboarding`, tetapi rutenya memang tidak merender carousel.
 *   Perbaikannya memasang kembali carousel sebagai isi layar ini.
 *
 * Keputusan non-obvious:
 *   - CTA "Daftar"/"Masuk" SELALU terlihat di semua slide (bukan hanya di
 *     slide terakhir): user baru tidak boleh terjebak di intro, dan pintu
 *     "Masuk" untuk user lama tetap satu ketukan. "Lanjut" hanya memindah
 *     halaman — bukan aksi yang mengakhiri intro.
 *   - Flag `onboardingSeen` ditandai saat user MENINGGALKAN layar lewat
 *     Daftar/Masuk (lihat lib/onboarding.ts), bukan saat slide terakhir
 *     tampil — menutup app di tengah intro berarti intro tampil lagi.
 *   - Header sengaja tidak dirender: intro adalah layar imersif (§4).
 *     "Lanjut" hidup di baris indikator supaya footer tidak menumpuk tiga
 *     tombol primer.
 *   - Tanpa teks "escrow"/"rekber"/"ditahan" di copy slide (kebijakan copy
 *     2026-10-10) — lihat components/onboarding/slides.tsx.
 */

import { useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"

import {
  OnboardingCarousel,
  type OnboardingCarouselHandle,
} from "@/components/onboarding/onboarding-carousel"
import { ONBOARDING_SLIDES } from "@/components/onboarding/slides"
import { Button } from "@/components/ui/button"
import { PageIndicator } from "@/components/ui/page-indicator"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { haptic } from "@/lib/haptics"
import { markOnboardingSeen } from "@/lib/onboarding"
import { ROUTES } from "@/lib/routes"

export default function OnboardingScreen() {
  const router = useRouter()
  const carouselRef = useRef<OnboardingCarouselHandle>(null)
  const [index, setIndex] = useState(0)

  const lastIndex = ONBOARDING_SLIDES.length - 1
  const isLastSlide = index >= lastIndex

  const handleIndexChange = useCallback(
    (next: number) => {
      setIndex((current) => {
        if (next !== current) haptic("select")
        return next
      })
    },
    [],
  )

  const goNext = useCallback(() => {
    haptic("light")
    carouselRef.current?.scrollTo(index + 1)
  }, [index])

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
    <Screen padded={false} edges={["top", "bottom"]}>
      <OnboardingCarousel
        ref={carouselRef}
        slides={ONBOARDING_SLIDES}
        index={index}
        onIndexChange={handleIndexChange}
      />

      <VStack gap={5} className="px-5 pb-2 pt-3">
        {/* Baris indikator: titik halaman di tengah, "Lanjut" di kanan.
            Kolom penyeimbang kiri menjaga indikator benar-benar center saat
            tautan "Lanjut" muncul/hilang di slide terakhir. */}
        <View className="flex-row items-center gap-3">
          <View className="min-w-0 flex-1" />
          <PageIndicator count={ONBOARDING_SLIDES.length} index={index} />
          <View className="min-w-0 flex-1 items-end">
            {isLastSlide ? null : (
              <TextLink onPress={goNext} variant="body" weight={600}>
                Lanjut
              </TextLink>
            )}
          </View>
        </View>

        <VStack gap={3}>
          <Button onPress={() => void handleRegister()}>Daftar</Button>
          <Text variant="body" tone="secondary" className="text-center">
            Sudah punya akun?{" "}
            <TextLink inline onPress={() => void handleLogin()}>
              Masuk
            </TextLink>
          </Text>
        </VStack>
      </VStack>
    </Screen>
  )
}
