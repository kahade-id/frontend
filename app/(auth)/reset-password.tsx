/**
 * Kahade — Reset Password (screen #8b alur auth): verifikasi OTP + password baru.
 *
 * Struktur:
 *   <Header title="Reset Password" showBack={true}>
 *   VStack gap={8}:
 *     VStack (explanation text dengan email)
 *     VStack (form)
 *       OtpInput (6 digits)
 *       PasswordField (new password, dengan strength meter)
 *       PasswordField (confirm password)
 *     Button "Reset Password"
 *     Alert error (jika ada)
 *   VStack (footer)
 *     TextLink "Kirim ulang kode"
 *     TextLink "Ganti email"
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/reset-password  body ResetPasswordDto { email, otp, newPassword, confirmPassword }
 *   - Response: MessageResult { message }
 *   - Setelah reset berhasil, user bisa login dengan password baru
 *
 * Alur lengkap:
 *   1. User datang dari forgot-password screen dengan email sebagai param
 *   2. User masukkan OTP (6 digit) yang diterima via email
 *   3. User masukkan password baru (12+ char, kompleks)
 *   4. User konfirmasi password baru
 *   5. Submit → reset password → redirect ke login dengan pesan sukses
 *
 * Keputusan non-obvious:
 *   - Header WITH back button — user bisa kembali ke forgot-password untuk
 *     ganti email atau resend OTP.
 *   - OtpInput 6 digits dengan auto-focus. Tidak ada auto-submit — user
 *     tekan tombol "Reset Password" setelah semua field terisi.
 *   - Password baru memakai PasswordField DENGAN strength meter — user
 *     perlu membuat password yang kuat (12+ char, uppercase, lowercase, digit, symbol).
 *   - Confirm password memakai PasswordField confirmOf — validasi mismatch
 *     otomatis setelah blur.
 *   - Tombol "Reset Password" disabled selama submit dan kalau form tidak valid.
 *   - Validasi password: sama seperti registrasi (12+ char, kompleks).
 *     PasswordStrength criteria di-override dari default (8→12 char).
 *   - Setelah reset berhasil → redirect ke login. User bisa login dengan
 *     password baru. Tidak ada auto-login setelah reset (keamanan).
 *   - Link "Kirim ulang kode" → panggil forgot-password lagi dengan email yang sama.
 *     Ini inline (tidak navigate ke screen lain) untuk UX yang lebih smooth.
 *   - Link "Ganti email" → kembali ke forgot-password screen.
 *   - Error handling: OTP invalid/expired, password validation, network error, dll.
 *   - OTP error ditempel ke OtpInput (errorText), password error ke Alert.
 */
import { useCallback, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { OtpInput, type OtpInputHandle } from "@/components/ui/otp-input"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MAX, SECURITY_CRITERIA, isPasswordValid } from "@/lib/auth-constants"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

/** Cooldown kirim ulang (detik) — bila backend tidak mengirim `cooldownSeconds` */
const DEFAULT_COOLDOWN = 60

export default function ResetPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const otpRef = useRef<OtpInputHandle>(null)
  const toast = useToast()

  // Email dari route params (dari forgot-password screen)
  const { email } = useLocalSearchParams<{ email: string }>()

  // Guard: kalau email tidak ada, kembali ke forgot-password
  if (!email) {
    router.replace(ROUTES.forgotPassword)
    return null
  }

  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [otpError, setOtpError] = useState<string | undefined>()
  // Resend: cooldown berjalan sejak layar dibuka (kode pertama baru saja dikirim)
  const [canResend, setCanResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdownKey, setCountdownKey] = useState(0)

  const passwordValid = isPasswordValid(newPassword)
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword
  const isFormValid = otp.length === 6 && passwordValid && passwordsMatch

  const handleReset = useCallback(async () => {
    if (submitting || !isFormValid) return
    setSubmitting(true)
    setFormError(null)
    setOtpError(undefined)

    try {
      await api.auth.resetPassword({
        email,
        otp,
        newPassword,
        confirmPassword,
      })

      // Success → toast (provider di root layout, tetap tampil setelah replace) → login
      toast.show({
        title: "Kata sandi diperbarui",
        description: "Silakan masuk dengan kata sandi baru Anda.",
        tone: "success",
      })
      if (router.canDismiss()) {
        router.dismissAll()
      } else {
        router.replace(ROUTES.login)
      }
    } catch (err) {
      if (isApiError(err)) {
        // OTP invalid/expired
        if (err.code === "UNAUTHORIZED" || err.code === "BAD_REQUEST") {
          const mentionsOtp = /otp|code|kode|invalid|expired/i.test(err.message || "")
          if (mentionsOtp) {
            setOtpError(err.message || "Kode tidak valid atau sudah kedaluwarsa.")
            setOtp("")
            otpRef.current?.focus()
            return
          }
        }
        // Password validation
        if (err.code === "VALIDATION") {
          const mentionsPassword = /password|kata sandi/i.test(err.message || "")
          if (mentionsPassword) {
            setFormError(err.message || "Password tidak memenuhi persyaratan.")
            return
          }
        }
        // Rate limited
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, isFormValid, email, otp, newPassword, confirmPassword, router, toast])

  const handleResendCode = useCallback(async () => {
    if (resending || !canResend) return
    setResending(true)
    setFormError(null)
    setOtpError(undefined)
    // Panggil forgot-password lagi dengan email yang sama
    try {
      await api.auth.forgotPassword({ email })
      // Sukses → tetap di layar ini; kosongkan OTP lama & mulai ulang cooldown
      setOtp("")
      otpRef.current?.focus()
      setCountdownKey((k) => k + 1)
      setCanResend(false)
      toast.show({
        title: "Kode baru telah dikirim",
        description: `Periksa kotak masuk ${email}.`,
        tone: "success",
      })
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setResending(false)
    }
  }, [email, resending, canResend, toast])

  const handleChangeEmail = useCallback(() => {
    router.replace(ROUTES.forgotPassword)
  }, [router])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Reset Password" safeArea={false} />

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
              <Heading level={1}>Masukkan kode verifikasi</Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Kode 6 digit telah dikirim ke <Text weight={600}>{email}</Text>.
                Masukkan kode dan buat password baru.
              </Text>
            </VStack>

            {/* Form fields */}
            <VStack gap={4}>
              <OtpInput
                ref={otpRef}
                length={6}
                value={otp}
                onChange={(code) => {
                  setOtp(code)
                  setOtpError(undefined)
                  setFormError(null)
                }}
                errorText={otpError}
                helperText={otpError ? undefined : "Masukkan 6 digit kode dari email"}
                disabled={submitting}
                autoFocus
              />

              <PasswordField
                label="Password baru"
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t)
                  setFormError(null)
                }}
                showStrength
                strengthProps={{
                  criteria: SECURITY_CRITERIA,
                  showCriteria: true,
                }}
                disabled={submitting}
                required
                maxLength={PASSWORD_MAX}
                returnKeyType="next"
              />

              <PasswordField
                label="Konfirmasi password baru"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t)
                  setFormError(null)
                }}
                confirmOf={newPassword}
                disabled={submitting}
                required
                maxLength={PASSWORD_MAX}
                returnKeyType="done"
                onSubmitEditing={() => void handleReset()}
              />
            </VStack>

            {/* Submit button */}
            <Button
              onPress={() => void handleReset()}
              loading={submitting}
              disabled={!isFormValid}
            >
              Reset Password
            </Button>

            {/* Error alert */}
            {formError ? (
              <Alert
                tone="danger"
                title="Gagal reset password"
                onDismiss={() => setFormError(null)}
              >
                {formError}
              </Alert>
            ) : null}
          </VStack>
        </ScrollView>

        {/* Footer links */}
        <View
          className="w-full gap-4 border-t border-border bg-background px-6 pt-4"
          style={{ paddingBottom: tokens.space[4] + insets.bottom }}
        >
          <View className="flex-row items-center justify-center gap-6">
            {canResend ? (
              <TextLink onPress={() => void handleResendCode()} disabled={submitting || resending}>
                {resending ? "Mengirim kode baru…" : "Kirim ulang kode"}
              </TextLink>
            ) : (
              <Countdown
                key={countdownKey}
                seconds={DEFAULT_COOLDOWN}
                prefix="Kirim ulang dalam"
                tone="secondary"
                onComplete={() => setCanResend(true)}
              />
            )}
            <TextLink onPress={handleChangeEmail} disabled={submitting}>
              Ganti email
            </TextLink>
          </View>
        </View>
      </KeyboardAvoiding>
    </Screen>
  )
}