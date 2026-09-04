/**
 * Kahade — Onboarding (screen #1 alur auth): welcome/intro slides.
 *
 * Struktur:
 *   [Logo lockup]                      [Lewati]
 *   ── slide (artefak + judul Display + body) ── swipe horizontal
 *   ● ○ ○
 *   [ Lanjut / Buat Akun ]
 *   Sudah punya akun? Masuk
 *
 * Keputusan non-obvious:
 *   - <Screen padded={false}>: pager harus full-width agar halaman ter-snap
 *     ke tepi; padding 24px (§4) diterapkan di dalam tiap slide dan di baris
 *     header/footer sendiri. Footer TIDAK memakai slot `footer` Screen karena
 *     slot itu menggambar `border-t` — di layar hero tanpa scroll, garis itu
 *     memotong komposisi; safe-area bawah tetap dari Screen (`edges` default).
 *   - Tidak ada <Header>: onboarding tidak punya "kembali" dan judulnya hidup
 *     di dalam slide. Baris atas cukup Logo + TextLink "Lewati" (link, bukan
 *     Button ghost — ini navigasi keluar dari intro, bukan aksi).
 *   - Ada satu heading per slide (DisplayHeading = header untuk SR); tidak ada
 *     H1 tambahan supaya tidak dua judul di satu layar (checklist audit #8).
 *   - Semua jalan keluar (Lewati, Buat Akun, Masuk) memanggil
 *     `markOnboardingSeen()` lalu `router.replace` — onboarding tidak boleh
 *     tersisa di back stack, dan gate `app/index.tsx` tidak akan
 *     menampilkannya lagi. Menyimpan flag SEBELUM navigasi supaya kalau
 *     app ditutup persis setelah pindah, flag sudah tersimpan.
 *   - Target rute `register`/`login` belum ada (dibuat di giliran berikut);
 *     path dipusatkan di `lib/routes.ts` dengan catatan cast `Href`.
 *   - Tombol utama berganti label "Lanjut" → "Buat Akun" di slide terakhir
 *     (satu tombol, bukan dua) — mengikuti prinsip "ruang bernapas" §1.5.
 */
import { useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"

import { OnboardingCarousel, type OnboardingCarouselHandle } from "@/components/onboarding/onboarding-carousel"
import { ONBOARDING_SLIDES } from "@/components/onboarding/slides"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/ui/fade-in"
import { Logo } from "@/components/ui/logo"
import { PageIndicator } from "@/components/ui/page-indicator"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { markOnboardingSeen } from "@/lib/onboarding"
import { ROUTES } from "@/lib/routes"

export default function OnboardingScreen() {
  const router = useRouter()
  const carousel = useRef<OnboardingCarouselHandle>(null)
  const [index, setIndex] = useState(0)
  const isLast = index === ONBOARDING_SLIDES.length - 1

  const leave = useCallback(
    async (to: typeof ROUTES.register | typeof ROUTES.login) => {
      await markOnboardingSeen()
      router.replace(to)
    },
    [router],
  )

  const handlePrimary = useCallback(() => {
    if (isLast) void leave(ROUTES.register)
    else carousel.current?.scrollTo(index + 1)
  }, [isLast, index, leave])

  return (
    <Screen padded={false}>
      {/* Baris atas: brand + jalan keluar cepat */}
      <View className="h-14 w-full flex-row items-center justify-between px-6">
        <Logo variant="lockup" size="sm" />
        <TextLink onPress={() => void leave(ROUTES.login)} accessibilityLabel="Lewati pengenalan">
          Lewati
        </TextLink>
      </View>

      {/* Slide — satu reveal halus saat masuk (§8), setelah itu tenang */}
      <FadeIn duration="slow" className="flex-1">
        <OnboardingCarousel ref={carousel} slides={ONBOARDING_SLIDES} index={index} onIndexChange={setIndex} />
      </FadeIn>

      {/* Footer: indikator + CTA + link masuk */}
      <View className="w-full gap-6 px-6 pb-4 pt-2">
        <PageIndicator count={ONBOARDING_SLIDES.length} index={index} />

        <View className="gap-4">
          <Button onPress={handlePrimary}>{isLast ? "Buat Akun" : "Lanjut"}</Button>

          <Text variant="body" tone="secondary" className="text-center">
            Sudah punya akun?{" "}
            <TextLink inline onPress={() => void leave(ROUTES.login)}>
              Masuk
            </TextLink>
          </Text>
        </View>
      </View>
    </Screen>
  )
}
