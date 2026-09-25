/**
 * Kahade — Onboarding (screen #1 alur auth): welcome/intro slides.
 *
 * Struktur:
 *   [Logo lockup]                      [Lewati]
 *   ── slide (artefak + eyebrow + judul Display + body) ── swipe horizontal
 *   ● ○ ○
 *   [ Lanjut ▸ / Buat akun ]
 *   [ Masuk ]        (slide terakhir: dua jalan berdampingan)
 *
 * Revisi 2026-09-26 (penyempurnaan UI/UX):
 *   - EYEBROW per slide: satu frasa di atas judul yang memberi tahu apa yang
 *     sedang dilihat, sehingga artefaknya tidak terbaca sebagai "kartu
 *     transaksi generik".
 *   - "Lewati" HANYA tampil selama masih ada slide berikutnya. Di slide
 *     terakhir tombolnya tidak punya arti (sudah di akhir) dan bersaing
 *     dengan CTA utama.
 *   - CTA utama diberi panah "Lanjut ▸" — verb + arah, bukan kata benda yang
 *     mengambang.
 *   - Slide terakhir menampilkan DUA jalan sejajar (Buat akun / Masuk):
 *     sebelumnya "Masuk" hanya berupa tautan teks satu baris di bawah tombol,
 *     sehingga separuh pengguna yang sudah punya akun tidak melihatnya.
 *   - Geser slide & ketuk CTA memberi umpan balik haptic ringan (§8):
 *     perpindahan halaman di pager ini tidak punya penanda lain.
 *
 * Keputusan non-obvious yang dipertahankan:
 *   - <Screen padded={false}>: pager harus full-width agar halaman ter-snap
 *     ke tepi; padding 20px (§4) diterapkan di dalam tiap slide dan di baris
 *     header/footer sendiri. Footer TIDAK memakai slot `footer` Screen karena
 *     slot itu menggambar `border-t` — di layar hero tanpa scroll, garis itu
 *     memotong komposisi; safe-area bawah tetap dari Screen (`edges` default).
 *   - Tidak ada <Header>: onboarding tidak punya "kembali" dan judulnya hidup
 *     di dalam slide.
 *   - Ada satu heading per slide (DisplayHeading = header untuk SR); tidak ada
 *     H1 tambahan supaya tidak dua judul di satu layar (checklist audit #8).
 *   - Semua jalan keluar (Lewati, Buat Akun, Masuk) memanggil
 *     `markOnboardingSeen()` lalu `router.replace` — onboarding tidak boleh
 *     tersisa di back stack, dan gate `app/index.tsx` tidak akan
 *     menampilkannya lagi. Menyimpan flag SEBELUM navigasi supaya kalau
 *     app ditutup persis setelah pindah, flag sudah tersimpan.
 */
import { useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowRight } from "phosphor-react-native"

import { OnboardingCarousel, type OnboardingCarouselHandle } from "@/components/onboarding/onboarding-carousel"
import { ONBOARDING_SLIDES } from "@/components/onboarding/slides"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/ui/fade-in"
import { Logo } from "@/components/ui/logo"
import { PageIndicator } from "@/components/ui/page-indicator"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { haptic } from "@/lib/haptics"
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
    if (isLast) {
      haptic("select")
      void leave(ROUTES.register)
      return
    }
    haptic("light")
    carousel.current?.scrollTo(index + 1)
  }, [isLast, index, leave])

  /** Geser halaman: sinkronkan indeks + umpan balik sentuhan. */
  const handleIndexChange = useCallback((next: number) => {
    setIndex((current) => {
      if (current !== next) haptic("light")
      return next
    })
  }, [])

  return (
    <Screen padded={false}>
      {/* Baris atas: brand + jalan keluar cepat (hilang di slide terakhir) */}
      <View className="h-14 w-full flex-row items-center justify-between px-5">
        <Logo variant="lockup" size="sm" />
        {isLast ? null : (
          <TextLink onPress={() => void leave(ROUTES.login)} accessibilityLabel="Lewati pengenalan">
            Lewati
          </TextLink>
        )}
      </View>

      {/* Slide — satu reveal halus saat masuk (§8), setelah itu tenang */}
      <FadeIn duration="slow" className="flex-1">
        <OnboardingCarousel
          ref={carousel}
          slides={ONBOARDING_SLIDES}
          index={index}
          onIndexChange={handleIndexChange}
        />
      </FadeIn>

      {/* Footer: indikator + CTA + jalan masuk akun */}
      <View className="w-full gap-5 px-5 pb-6 pt-2">
        <PageIndicator count={ONBOARDING_SLIDES.length} index={index} />

        <View className="gap-3">
          <Button onPress={handlePrimary} rightIcon={isLast ? undefined : ArrowRight}>
            {isLast ? "Buat akun" : "Lanjut"}
          </Button>

          {isLast ? (
            // Dua jalan SEJAJAR di slide akhir: separuh pengunjung layar ini
            // datang dengan akun yang sudah ada.
            <Button variant="secondary" onPress={() => void leave(ROUTES.login)}>
              Masuk
            </Button>
          ) : (
            <Text variant="body" tone="secondary" className="text-center">
              Sudah punya akun?{" "}
              <TextLink inline onPress={() => void leave(ROUTES.login)}>
                Masuk
              </TextLink>
            </Text>
          )}
        </View>
      </View>
    </Screen>
  )
}
