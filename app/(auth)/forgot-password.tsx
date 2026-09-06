/**
 * Kahade — Forgot Password (screen #8a alur auth): kirim OTP reset password.
 *
 * Struktur:
 *   <Header title="Lupa Password" showBack={true}>
 *   VStack gap={8}:
 *     VStack (explanation text)
 *     VStack (form)
 *       EmailField
 *     Button "Kirim Kode"
 *     Alert error (jika ada)
 *   VStack (footer)
 *     TextLink "Kembali ke login"
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/forgot-password  body ForgotPasswordDto { email }
 *   - Response: MessageResult { message }
 *   - Backend mengirim OTP ke email user
 *
 * Alur lengkap:
 *   1. User masukkan email → screen ini kirim OTP
 *   2. Success → navigate ke reset-password dengan email sebagai param
 *   3. Reset password screen: masukkan OTP + password baru + konfirmasi
 *
 * Keputusan non-obvious:
 *   - Header WITH back button — user bisa kembali ke login tanpa mengirim OTP.
 *   - Email auto-trim whitespace di blur (sama seperti EmailField default).
 *   - Setelah berhasil kirim OTP → navigate ke reset-password dengan email
 *     sebagai route param. Email tidak disimpan di state global karena
 *     hanya dipakai di 2 screen ini (forgot + reset).
 *   - Error handling: email tidak terdaftar, network error, rate limited, dll.
 *   - Pesan sukses TIDAK menampilkan detail email untuk keamanan (hindari
 *     email enumeration). Backend yang menentukan apakah email terdaftar atau tidak.
 *   - Tombol "Kirim Kode" disabled selama submit untuk mencegah double-submit.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { ROUTES } from "@/lib/routes"

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const isFormValid = isValidEmail(email)

  const handleSendCode = useCallback(async () => {
    if (submitting || !isFormValid) return
    setSubmitting(true)
    setFormError(null)

    try {
      await api.auth.forgotPassword({
        email: email.trim(),
      })

      // Success → navigate ke reset-password dengan email sebagai param
      router.replace(ROUTES.resetPassword(email.trim()))
    } catch (err) {
      if (isApiError(err)) {
        // Email tidak terdaftar
        if (err.code === "NOT_FOUND") {
          setFormError("Email tidak terdaftar. Periksa kembali atau daftar akun baru.")
          return
        }
        // Rate limited
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
        // Validation error
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          setFormError(err.message || "Email tidak valid. Periksa kembali.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, isFormValid, email, router])

  const handleBackToLogin = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace(ROUTES.login)
    }
  }, [router])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Lupa Password" safeArea={false} />

      <KeyboardAvoiding offset={insets.top}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VStack gap={8}>
            {/* Explanation text */}
            <VStack gap={2}>
              <Heading level={1}>Lupa password?</Heading>
              <Text numberOfLines={1} variant="body" tone="secondary" className="text-pretty">
                Masukkan email yang terdaftar di akun Anda. Kami akan mengirim
                kode verifikasi untuk mereset password.
              </Text>
            </VStack>

            {/* Form */}
            <VStack gap={4}>
              <EmailField
                label="Email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t)
                  setFormError(null)
                }}
                autoFocus
                required
                returnKeyType="done"
                onSubmitEditing={() => void handleSendCode()}
                autoComplete="email"
                textContentType="emailAddress"
              />
            </VStack>

            {/* Submit button */}
            <Button accessibilityHint="Ketuk untuk berinteraksi"
              onPress={() => void handleSendCode()}
              loading={submitting}
              disabled={!isFormValid}
            >
              Kirim Kode
            </Button>

            {/* Error alert */}
            {formError ? (
              <Alert
                tone="danger"
                title="Gagal mengirim kode"
                onDismiss={() => setFormError(null)}
              >
                {formError}
              </Alert>
            ) : null}
          </VStack>
        </ScrollView>

        {/* Footer */}
        <FooterBar>
          <View accessible={false} className="items-center">
            <TextLink onPress={handleBackToLogin} disabled={submitting}>
              Kembali ke login
            </TextLink>
          </View>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}