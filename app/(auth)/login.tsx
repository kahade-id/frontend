/**
 * Kahade — Login (screen #7 alur auth): email + password.
 *
 * Struktur:
 *   <Header title="Masuk" showBack={false}>
 *   VStack gap={8}:
 *     VStack (welcome text)
 *     VStack (form fields)
 *       EmailField
 *       PasswordField (tanpa strength meter — ini login, bukan registrasi)
 *     Button "Masuk"
 *     Alert error (jika ada)
 *   VStack (footer links)
 *     TextLink "Lupa password?"
 *     Text "Belum punya akun? Daftar"
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/login  body LoginDto { email, password, deviceId }
 *   - deviceId auto-inject oleh withDevice() di auth.ts
 *   - Response: LoginResult = discriminated union
 *     - requiresTwoFactor: false → { accessToken, user? } → token disimpan otomatis
 *     - requiresTwoFactor: true → { tempToken, user? } → /verify-2fa (kode TOTP
 *       atau backup code → POST /v1/auth/2fa/verify-login)
 *
 * Keputusan non-obvious:
 *   - Header TANPA back button — ini entry point untuk user yang sudah punya akun.
 *     User bisa kembali ke onboarding via tombol "Daftar" (tapi onboarding sudah seen,
 *     jadi tidak akan muncul lagi). Satu-satunya jalan keluar adalah close app atau
 *     navigate ke register via link "Belum punya akun? Daftar".
 *   - PasswordField TIDAK pakai showStrength — ini login, bukan registrasi. User
 *     tidak perlu melihat kekuatan password saat masuk. Label memakai default
 *     komponen ("Kata sandi") — istilah yang sama dengan alur registrasi dan
 *     reset; jangan campur "Password"/"Kata sandi" antar layar (§12).
 *   - `offset` KeyboardAvoiding = inset atas + tinggi Header, sama seperti
 *     layar registrasi; tanpa tinggi header, padding keyboard iOS kurang 56px
 *     dan field bawah tertutup keyboard.
 *   - 2FA: kalau backend return requiresTwoFactor: true, tempToken disimpan
 *     di memori (lib/two-factor-login) dan navigasi ke /verify-2fa — BUKAN
 *     lewat param URL (kredensial tidak boleh lewat route params).
 *   - Tombol "Masuk" disabled selama submit untuk mencegah double-submit.
 *   - Email auto-trim whitespace di blur (sama seperti EmailField default).
 *   - Error handling: invalid credentials, network error, rate limited, dll.
 *   - Setelah login berhasil → /welcome (cek permissions; bukan user baru).
 *   - Link "Lupa password?" → navigate ke forgot-password screen.
 *   - Link "Belum punya akun? Daftar" → navigate ke register screen.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { ROUTES } from "@/lib/routes"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isFormValid = isValidEmail(email) && password.length > 0

  const handleLogin = useCallback(async () => {
    if (submitting || !isFormValid) return
    setSubmitting(true)
    setFormError(null)

    try {
      const result = await api.auth.login({
        email: email.trim(),
        password,
      })

      if (result.requiresTwoFactor) {
        // Akun memakai TOTP → simpan tempToken di memori, lanjut ke layar kode.
        // `push` (bukan replace) supaya tombol kembali membawa ke form login.
        setPendingTwoFactorLogin({ tempToken: result.tempToken, email: email.trim() })
        router.push(ROUTES.verify2fa)
        return
      }

      // Login berhasil → welcome screen (cek permissions). Bukan user baru.
      router.replace(ROUTES.welcome())
    } catch (err) {
      if (isApiError(err)) {
        // Invalid credentials
        if (err.code === "UNAUTHORIZED") {
          setFormError("Email atau kata sandi salah. Periksa kembali dan coba lagi.")
          return
        }
        // Rate limited
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
        // Validation error
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          setFormError(err.message || "Data tidak valid. Periksa email dan kata sandi Anda.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, isFormValid, email, password, router])

  const handleForgotPassword = useCallback(() => {
    router.push(ROUTES.forgotPassword)
  }, [router])

  const handleRegister = useCallback(() => {
    router.push(ROUTES.register)
  }, [router])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Masuk" safeArea={false} showBack={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VStack gap={8}>
            {/* Welcome text */}
            <VStack gap={2}>
              <Heading level={1} className="text-balance">
                Selamat datang kembali
              </Heading>
              <Text numberOfLines={1} variant="body" tone="secondary" className="text-pretty">
                Masuk ke akun Kahade Anda untuk melanjutkan.
              </Text>
            </VStack>

            {/* Form fields */}
            <VStack gap={4}>
              <EmailField
                label="Email"
                value={email}
                helperText="Contoh: nama@email.com"
                onChangeText={(t) => {
                  setEmail(t)
                  setFormError(null)
                }}
                autoFocus
                required
                returnKeyType="next"
                keyboardType="email-address"
                autoCapitalize="none"
                disabled={submitting}
              />

              {/* Label default PasswordField = "Kata sandi" — konsisten dengan alur registrasi */}
              <PasswordField
                value={password}
                onChangeText={(t) => {
                  setPassword(t)
                  setFormError(null)
                }}
                required
                returnKeyType="done"
                onSubmitEditing={() => void handleLogin()}
                maxLength={PASSWORD_MAX}
                disabled={submitting}
              />
            </VStack>

            {/* Submit button */}
            <Button
              onPress={() => void handleLogin()}
              loading={submitting}
              disabled={!isFormValid}
            >
              Masuk
            </Button>

            {/* Error alert */}
            {formError ? (
              <Alert
                tone="danger"
                title="Gagal masuk"
                onDismiss={() => setFormError(null)}
              >
                {formError}
              </Alert>
            ) : null}
          </VStack>
        </ScrollView>

        {/* Footer links */}
        <FooterBar>
          <View accessible={false} className="items-center">
            <TextLink onPress={handleForgotPassword} disabled={submitting}>
              Lupa password?
            </TextLink>
          </View>

          <Text variant="body" tone="secondary" className="text-center">
            Belum punya akun?{" "}
            <TextLink inline onPress={handleRegister}>
              Daftar
            </TextLink>
          </Text>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}