/**
 * Screen — Verifikasi email akun.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/verify-email          VerifyEmailDto { email ≤254, otp 6 digit }
 *   POST /v1/auth/resend-verification   ResendVerificationDto { email }
 *   POST /v1/auth/correct-email         CorrectEmailDto { newEmail, password ≤72 }
 *        (salah ketik email saat daftar → ganti + kirim ulang OTP ke alamat baru)
 *   (GET /v1/auth/verify-email?email&token = varian tautan email; ditangani
 *    deeplink, bukan layar ini.)
 *
 * Masuk dari Edit Profil (banner "Email belum diverifikasi") dengan param
 * `email`. Alur:
 *   1. Tombol "Kirim kode" (resend) → cooldown 60 d (Countdown) → isi OTP →
 *      verifikasi → toast sukses → kembali.
 *   2. "Email salah?" → BottomSheet: email baru + password akun →
 *      correct-email → email di layar berganti, OTP dikirim ke alamat baru.
 *
 * Keputusan non-obvious:
 *   - Kode TIDAK otomatis dikirim saat layar dibuka: user bisa sudah punya
 *     kode dari email pendaftaran; mengirim ulang otomatis akan
 *     menginvalidasi kode lama di beberapa backend. Tombol eksplisit.
 *   - Endpoint auth: "none" di spec → dipanggil tanpa bearer; sesi tetap ada.
 */
import { useCallback, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { haptic } from "@/lib/haptics"

import { Alert } from "@/components/ui/alert"
import { FooterBar } from "@/components/ui/footer-bar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { OtpInput, type OtpInputHandle } from "@/components/ui/otp-input"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"

/** VerifyEmailDto.otp: 6 digit */
const OTP_LENGTH = 6
/** Cooldown kirim ulang (detik) — backend tidak mengirim nilai */
const RESEND_COOLDOWN = 60

export default function VerifyEmailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const otpRef = useRef<OtpInputHandle>(null)

  const { email: emailParam } = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(emailParam ?? "")

  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [canResend, setCanResend] = useState(true)
  const [countdownKey, setCountdownKey] = useState(0)

  const [correctOpen, setCorrectOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [password, setPassword] = useState("")
  const [correcting, setCorrecting] = useState(false)
  const [correctError, setCorrectError] = useState<string | null>(null)

  const handleSend = useCallback(async () => {
    if (!email || sending || !canResend) return
    setSending(true)
    setFormError(null)
    setOtpError(undefined)
    try {
      await api.auth.resendVerification({ email })
      setSent(true)
      setCanResend(false)
      setCountdownKey((k) => k + 1)
      setOtp("")
      otpRef.current?.focus()
      toast.show({ title: "Kode dikirim", description: `Periksa kotak masuk ${email}.`, tone: "success" })
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSending(false)
    }
  }, [email, sending, canResend, toast])

  const handleVerify = useCallback(async () => {
    if (!email || verifying || otp.length < OTP_LENGTH) return
    setVerifying(true)
    setFormError(null)
    setOtpError(undefined)
    try {
      await api.auth.verifyEmail({ email, otp })
      haptic("success")
      toast.show({ title: "Email terverifikasi", tone: "success" })
      router.back()
    } catch (err) {
      haptic("error")
      if (isApiError(err) && (err.code === "BAD_REQUEST" || err.code === "UNAUTHORIZED" || err.code === "VALIDATION")) {
        setOtpError(err.message || "Kode tidak valid atau sudah kedaluwarsa.")
        setOtp("")
        otpRef.current?.focus()
      } else {
        setFormError(userMessage(err))
      }
    } finally {
      setVerifying(false)
    }
  }, [email, verifying, otp, toast, router])

  const handleCorrect = useCallback(async () => {
    const target = newEmail.trim()
    if (!isValidEmail(target) || !password || correcting) return
    setCorrecting(true)
    setCorrectError(null)
    try {
      await api.auth.correctEmail({ newEmail: target, password })
      setEmail(target)
      setCorrectOpen(false)
      setNewEmail("")
      setPassword("")
      setSent(true)
      setCanResend(false)
      setCountdownKey((k) => k + 1)
      setOtp("")
      toast.show({ title: "Email diperbarui", description: `Kode verifikasi dikirim ke ${target}.`, tone: "success" })
    } catch (err) {
      setCorrectError(userMessage(err))
    } finally {
      setCorrecting(false)
    }
  }, [newEmail, password, correcting, toast])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Verifikasi email" safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-8">
            <View className="gap-3">
              <Heading level={1} className="text-balance">
                Verifikasi alamat email Anda
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Kami mengirim kode 6 digit ke alamat berikut. Masukkan kode untuk mengonfirmasi bahwa email ini milik Anda.
              </Text>
              <Text variant="monoBody" weight={600}>
                {email || "—"}
              </Text>
            </View>

            {!sent ? (
              <Button onPress={() => void handleSend()} loading={sending} disabled={!email}>
                Kirim kode verifikasi
              </Button>
            ) : null}

            <OtpInput
              ref={otpRef}
              length={OTP_LENGTH}
              value={otp}
              onChange={(v) => {
                setOtp(v)
                setOtpError(undefined)
              }}
              errorText={otpError}
              helperText={otpError ? undefined : "Kode berlaku beberapa menit"}
              disabled={verifying || !email}
              accessibilityLabel="Kode verifikasi email 6 digit"
            />

            <Button onPress={() => void handleVerify()} loading={verifying} disabled={otp.length < OTP_LENGTH}>
              Verifikasi
            </Button>

            {formError ? (
              <Alert tone="danger" title="Gagal" onDismiss={() => setFormError(null)}>
                {formError}
              </Alert>
            ) : null}
          </View>
        </ScrollView>

        <FooterBar>
          <View className="items-center">
            {canResend ? (
              <TextLink onPress={() => void handleSend()} disabled={sending || !email}>
                {sending ? "Mengirim…" : sent ? "Kirim ulang kode" : "Sudah punya kode? Masukkan di atas"}
              </TextLink>
            ) : (
              <Countdown
                key={countdownKey}
                seconds={RESEND_COOLDOWN}
                prefix="Kirim ulang dalam"
                tone="secondary"
                onComplete={() => setCanResend(true)}
              />
            )}
          </View>
          <Text variant="body" tone="secondary" className="text-center">
            Email salah?{" "}
            <TextLink inline onPress={() => setCorrectOpen(true)}>
              Perbaiki alamat email
            </TextLink>
          </Text>
        </FooterBar>
      </KeyboardAvoiding>

      <BottomSheet
        visible={correctOpen}
        onRequestClose={() => (correcting ? undefined : setCorrectOpen(false))}
        title="Perbaiki alamat email"
        description="Masukkan email yang benar dan kata sandi akun untuk konfirmasi. Kode verifikasi akan dikirim ke alamat baru."
        footer={
          <View className="gap-2">
            <Button
              variant="primary"
              loading={correcting}
              disabled={!isValidEmail(newEmail.trim()) || !password}
              onPress={() => void handleCorrect()}
              fullWidth
            >
              Simpan & kirim kode
            </Button>
            <Button variant="ghost" disabled={correcting} onPress={() => setCorrectOpen(false)} fullWidth>
              Batal
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          <EmailField label="Email baru" value={newEmail} onChangeText={setNewEmail} autoFocus />
          <PasswordField
            label="Kata sandi akun"
            value={password}
            onChangeText={setPassword}
            maxLength={PASSWORD_MAX}
            returnKeyType="done"
            onSubmitEditing={() => void handleCorrect()}
          />
          {correctError ? (
            <Alert tone="danger" onDismiss={() => setCorrectError(null)}>
              {correctError}
            </Alert>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  )
}
