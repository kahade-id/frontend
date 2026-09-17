/**
 * Kahade — Forgot Password (screen #8a alur auth): kirim OTP reset password.
 *
 * Struktur:
 *   <Header title="Lupa Password" showBack={true}>
 *   VStack gap={8}:
 *     VStack (explanation text)
 *     VStack (form)
 *       EmailField
 *       CaptchaSlider  ← muncul HANYA saat backend memintanya
 *     Button "Kirim Kode"
 *     Alert error (jika ada)
 *   VStack (footer)
 *     TextLink "Kembali ke login"
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/forgot-password  body ForgotPasswordDto { email, captchaId, captchaAnswer }
 *   - Response: MessageResult { message }
 *   - Backend mengirim OTP ke email user
 *
 * CATATAN KONTRAK (audit 2026-09-16): layar ini dulu hanya mengirim `{ email }`,
 * sehingga SETIAP permintaan ditolak backend dengan 401 `CAPTCHA_REQUIRED`
 * ("Captcha verification is required") dan pengguna melihat Alert "Gagal
 * mengirim kode" — bukan karena emailnya salah.
 *
 * Keputusan non-obvious:
 *   - Captcha diminta SECARA LAZY, sama seperti layar login: kirim dulu tanpa
 *     captcha, dan hanya kalau backend menjawab `CAPTCHA_REQUIRED` slider
 *     ditampilkan. Kebijakan captcha jadi milik backend saja — bila kebijakan
 *     berubah (mis. hanya setelah beberapa percobaan, seperti login), frontend
 *     tidak perlu diubah dan pengguna tidak melihat captcha sejak awal.
 *   - Header WITH back button — user bisa kembali ke login tanpa mengirim OTP.
 *   - Email auto-trim whitespace di blur (sama seperti EmailField default).
 *   - Setelah berhasil kirim OTP → navigate ke reset-password dengan email
 *     sebagai route param. Email tidak disimpan di state global karena
 *     hanya dipakai di 2 screen ini (forgot + reset).
 *   - Pesan sukses TIDAK menampilkan detail email untuk keamanan (hindari
 *     email enumeration). Backend yang menentukan apakah email terdaftar atau tidak.
 *   - Captcha backend memakai satu kali pakai: tantangan yang gagal/expired
 *     harus diganti, kalau tidak percobaan berikutnya pasti gagal dengan pesan
 *     yang sama. Karena itu setiap jawaban captcha yang ditolak dimuat ulang.
 *   - Captcha backend = slider (posisi persen), bukan gambar+kode: lihat
 *     komponen <CaptchaSlider>.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { CaptchaSlider } from "@/components/ui/captcha-slider"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { FieldLabel } from "@/components/ui/field"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import type { CaptchaChallenge } from "@/lib/api/auth"
import { CAPTCHA_MESSAGES } from "@/lib/captcha-messages"
import { ROUTES } from "@/lib/routes"

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // Prefill dari "Kirim ulang kode" di layar reset-password (lihat ROUTES).
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(typeof emailParam === "string" ? emailParam : "")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── Captcha (diminta backend, lazy) ───────────────────────────────
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState<string | null>(null)

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    setCaptchaError(null)
    setCaptchaAnswer(null)
    try {
      const next = await api.auth.generateCaptcha()
      setChallenge(next)
    } catch (err) {
      setChallenge(null)
      setCaptchaError(userMessage(err))
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  const handleSendCode = useCallback(async () => {
    if (submitting || !isValidEmail(email)) return
    // Slider sudah muncul tapi belum digeser — jangan buang percobaan.
    if (challenge && captchaAnswer === null) {
      setFormError(CAPTCHA_MESSAGES.required)
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      await api.auth.forgotPassword({
        email: email.trim(),
        // Hanya dikirim bila backend memang sudah meminta captcha.
        ...(challenge && captchaAnswer !== null
          ? { captchaId: challenge.captchaId, captchaAnswer }
          : {}),
      })

      // Success → navigate ke reset-password dengan email sebagai param
      router.replace(ROUTES.resetPassword(email.trim()))
    } catch (err) {
      if (isApiError(err)) {
        const captchaCode = err.backendCode ?? ""
        // Backend meminta captcha (atau menolak jawabannya) → tampilkan slider
        // dengan tantangan baru dan minta pengguna mencoba sekali lagi.
        if (
          captchaCode === "CAPTCHA_REQUIRED" ||
          captchaCode === "CAPTCHA_FAILED" ||
          captchaCode === "CAPTCHA_EXPIRED"
        ) {
          setFormError(
            captchaCode === "CAPTCHA_EXPIRED"
              ? CAPTCHA_MESSAGES.expired
              : captchaCode === "CAPTCHA_REQUIRED"
                ? CAPTCHA_MESSAGES.resetRequired
                : CAPTCHA_MESSAGES.failed,
          )
          await loadCaptcha()
          return
        }
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
  }, [submitting, email, challenge, captchaAnswer, router, loadCaptcha])

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
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* v2: form reveal satu kesatuan (fast) — pola yang sama di semua
              layar auth; FooterBar di bawah tetap statis. */}
          <FadeIn duration="fast">
          <VStack gap={8}>
            {/* Explanation text */}
            <VStack gap={2}>
              <Heading level={1}>Lupa password?</Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
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

              {/* Captcha: hanya setelah backend memintanya. Tantangan yang gagal
                  dimuat gagal → tampilkan pesan + jalan coba ulang, JANGAN
                  menggambar lintasan contoh (target palsu terlihat sungguhan). */}
              {challenge ? (
                <CaptchaSlider
                  targetX={challenge.targetX}
                  resetKey={challenge.captchaId}
                  solved={captchaAnswer !== null}
                  loading={captchaLoading}
                  disabled={submitting}
                  onSolve={setCaptchaAnswer}
                  onRefresh={() => void loadCaptcha()}
                  errorText={captchaError}
                />
              ) : captchaError ? (
                <View className="gap-2">
                  <FieldLabel required>Verifikasi keamanan</FieldLabel>
                  <Text variant="caption" tone="danger">
                    {CAPTCHA_MESSAGES.unavailable}
                  </Text>
                  <TextLink onPress={() => void loadCaptcha()} disabled={captchaLoading}>
                    Muat ulang tantangan
                  </TextLink>
                </View>
              ) : null}
            </VStack>

            {/* Submit button */}
            <Button
              onPress={() => void handleSendCode()}
              loading={submitting}
              disabled={!isValidEmail(email)}
            >
              Kirim kode
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
          </FadeIn>
        </ScrollView>

        {/* Footer */}
        <FooterBar>
          <View className="items-center">
            <TextLink onPress={handleBackToLogin} disabled={submitting}>
              Kembali ke login
            </TextLink>
          </View>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
