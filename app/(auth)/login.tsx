/**
 * Kahade — hub Masuk (screen #7, arsitektur baru 2026-10-10).
 *
 * SATU pintu masuk. Urutan visual:
 *   1. tiga aksi besar — Lanjut dengan Google, Lanjut dengan Apple (iOS),
 *      Masuk dengan Passkey;
 *   2. pemisah "atau";
 *   3. tiga metode yang masing-masing membuka HALAMAN SENDIRI
 *      (/login/whatsapp, /login/email, /login/username);
 *   4. pintu daftar (tetap HANYA lewat nomor HP) + pemulihan akun;
 *   5. satu baris persetujuan (<LegalConsent>) — bukan paragraf disclaimer.
 *
 * Kenapa hub, bukan form bertumpuk (non-obvious):
 *   Versi lama menaruh WhatsApp/Email/Username dalam satu rute dengan
 *   SegmentedControl. Akibatnya tinggi layar berubah tiap ganti metode, state
 *   (captcha, draft identifier, error) hidup berdampingan antar metode, dan
 *   tombol aksi harus menetap di FooterBar agar selalu terlihat. Dengan satu
 *   metode per halaman, tiap layar punya satu tugas, satu tombol di bawah
 *   kontennya sendiri, dan tidak ada state yang bisa bocor antar metode.
 *
 * Keputusan lain:
 *   - TIDAK ada form kredensial di layar ini, jadi tidak ada KeyboardAvoiding
 *     dan tidak ada FooterBar — konten pendek dan seluruhnya terlihat.
 *   - Deep link lama `/login?method=phone|email|username` di-<Redirect> ke
 *     halaman metodenya (bukan dirender inline) supaya satu rute = satu layar
 *     tetap berlaku untuk pemanggil lama. `?method=google|apple` memulai OAuth
 *     langsung di hub ini (tombolnya memang ada di sini).
 *   - `next` (tujuan semula) diteruskan ke halaman metode lewat query — path
 *     saja, bukan kredensial, jadi aman di URL (pola B-07/B-14).
 *   - Detail keamanan (lokasi perangkat, cara kerja kode WhatsApp) pindah ke
 *     ikon ⓘ di header — lihat components/auth/auth-security-info.tsx.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"

import { AuthSecurityInfo } from "@/components/auth/auth-security-info"
import { LegalConsent } from "@/components/auth/legal-consent"
import { LoginMethodList } from "@/components/auth/login-method-list"
import { LoginSocialSection } from "@/components/auth/login-social-section"
import { PasskeyLoginButton } from "@/components/auth/passkey-login-button"
import { Divider } from "@/components/ui/divider"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Logo } from "@/components/ui/logo"
import { Screen } from "@/components/ui/screen"
import { VStack } from "@/components/ui/stack"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { sanitizeNextPath } from "@/lib/login-redirect"
import { ROUTES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import type { SocialProvider } from "@/lib/api/social"

/**
 * Deep link lama masih memakai `?method=`. `phone` adalah nama lama metode
 * WhatsApp (form-nya memang OTP nomor HP).
 */
function providerFromParam(method?: string): SocialProvider | undefined {
  if (method === "google") return "GOOGLE"
  if (method === "apple") return "APPLE"
  return undefined
}

export default function LoginScreen() {
  const router = useRouter()
  const { next, method } = useLocalSearchParams<{ next?: string; method?: string }>()
  // #FE-N1: sanitasi terpusat (tolak //host, skema, backslash) — lihat lib/login-redirect.
  const nextPath = sanitizeNextPath(next) ?? undefined
  const legacyMethod = typeof method === "string" ? method : undefined
  const session = useAuthSession()
  const [autoStartProvider] = useState<SocialProvider | undefined>(() =>
    providerFromParam(legacyMethod) ?? undefined,
  )

  // Sesi masih hidup (mis. kembali dari background) → Beranda, bukan hub.
  useEffect(() => {
    if (!session.restoring && session.token) router.replace(ROUTES.home)
  }, [session.restoring, session.token, router])

  const legacyRedirect = useMemo(() => {
    switch (legacyMethod) {
      case "phone":
        return ROUTES.loginWhatsapp(nextPath)
      case "email":
        return ROUTES.loginEmail(nextPath)
      case "username":
        return ROUTES.loginUsername(nextPath)
      default:
        return null
    }
  }, [legacyMethod, nextPath])

  const handleRegister = useCallback(() => {
    router.push(ROUTES.register)
  }, [router])

  const handleForgotPassword = useCallback(() => {
    router.push(ROUTES.forgotPassword())
  }, [router])

  const handleDeletionStatus = useCallback(() => {
    router.push(ROUTES.deletionStatus)
  }, [router])

  if (legacyRedirect) return <Redirect href={legacyRedirect} />

  return (
    <Screen padded={false} edges={["top"]}>
      <Header
        title="Masuk"
        safeArea={false}
        showBack={false}
        right={<AuthSecurityInfo variant="signIn" />}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-5 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeIn duration="fast">
          <VStack gap={6}>
            <VStack gap={4} className="items-center pt-1">
              <Logo variant="lockup" size="md" />
              <VStack gap={2} className="items-center">
                <Heading level={1} className="text-balance">
                  Masuk ke Kahade
                </Heading>
                <Text variant="body" tone="secondary" className="text-center text-pretty">
                  Semua cara di bawah membuka akun yang sama. Pilih yang paling
                  mudah untuk Anda.
                </Text>
              </VStack>
            </VStack>

            {/* Aksi besar: sosial (dari kapabilitas server) + passkey (dari
                kapabilitas perangkat). Keduanya satu grup visual. */}
            <VStack gap={2}>
              <LoginSocialSection nextPath={nextPath} autoStartProvider={autoStartProvider} />
              <PasskeyLoginButton nextPath={nextPath} />
            </VStack>

            <Divider label="atau" />

            <LoginMethodList nextPath={nextPath} />

            <VStack gap={3} className="items-center pt-1">
              <Text variant="body" tone="secondary" className="text-center">
                Belum punya akun?{" "}
                <TextLink inline onPress={handleRegister}>
                  Daftar
                </TextLink>
              </Text>
              <TextLink variant="caption" onPress={handleForgotPassword}>
                Lupa kata sandi?
              </TextLink>
              <TextLink variant="caption" onPress={handleDeletionStatus}>
                Akun dihapus? Pulihkan di sini
              </TextLink>
            </VStack>

            <LegalConsent action="signIn" />
          </VStack>
        </FadeIn>
      </ScrollView>
    </Screen>
  )
}
