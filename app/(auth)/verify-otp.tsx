/**
 * Kahade — Verify OTP (screen #3 alur auth): masukkan kode 6 digit.
 *
 * Struktur:
 *   <Header title="Verifikasi OTP" progress=2/4>
 *   H1 "Masukkan kode verifikasi" + body (penjelasan + nomor HP Mono)
 *   <OtpInput> 6 digit
 *   [Button Verifikasi] — manual submit, disabled saat < 6 digit
 *   [Alert error, bila ada]
 *   ── footer: countdown / kirim ulang  •  ubah nomor HP
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/verify-otp  body VerifyPhoneOtpDto { phoneNumber, code, deviceId }
 *   - `deviceId` + `deviceInfo` DIINJEKSI OTOMATIS oleh `withDevice()` di auth.ts.
 *   - Response (UNVERIFIED — spec hanya `200: ""`): discriminated union
 *     `VerifyOtpResult`:
 *       • isNewUser: true  → { tempToken } → simpan di registration state → screen #4
 *       • isNewUser: false → { accessToken } → token disimpan otomatis → welcome
 *
 * Resend:
 *   POST /v1/auth/request-otp  body { phoneNumber, method }
 *   - Sama persis dengan yang dipanggil Register screen, memakai nomor + metode
 *     yang diwarisi dari route params.
 *   - Response: { cooldownSeconds? } → restart countdown (default 60 d).
 *
 * Keputusan non-obvious:
 *   - Submit MANUAL via tombol, BUKAN auto-submit saat 6 digit terisi — user
 *     punya kontrol penuh kapan kode dikirim, dan tombol memberi target sentuh
 *     yang jelas (44px+). OtpInput.onComplete hanya dipakai untuk fokus ke
 *     tombol secara visual (disabled → enabled).
 *   - Haptic feedback di momen kritikal (§8): "success" saat verifikasi
 *     berhasil, "error" saat OTP ditolak. Tidak dipakai untuk interaksi ringan.
 *   - Error dari backend dibedakan: pesan yang mengandung "code"/"otp"/"kode"
 *     ditempel ke OtpInput (errorText), sisanya ke <Alert>. Ini menghindari
 *     dua tempat error yang membingungkan untuk masalah yang sama.
 *   - Countdown default 60 detik (tidak bergantung response `cooldownSeconds`
 *     dari request awal — Register screen tidak menyimpannya). Saat resend
 *     berhasil, countdown restart dari 60 (atau `cooldownSeconds` bila ada).
 *   - `canResend` = countdown selesai. Tampilan berubah dari Countdown ke
 *     TextLink "Kirim ulang kode" — tidak ada tombol besar di footer untuk
 *     aksi sekunder.
 *   - Nomor HP ditampilkan Mono (data presisi, berdiri sendiri — §3.1) di
 *     bawah body penjelasan, bukan inline di paragraf.
 *   - tempToken disimpan di `lib/registration.ts` (module memory) — bukan
 *     SecureStore, bukan route params — karena short-lived dan tidak perlu
 *     bertahan dari restart.
 *   - "Ubah nomor HP" = `router.back()` ke Register. OTP yang sudah dikirim
 *     tetap valid di backend tapi tidak dipakai — user bisa minta OTP baru
 *     dari Register dengan nomor yang berbeda.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"

import { OtpInput, type OtpInputHandle } from "@/components/ui/otp-input"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { api, isApiError, userMessage, type OtpMethod } from "@/lib/api"
import { formatPhoneId } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { setRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

/** Progress: registrasi via HP = 4 langkah, ini langkah ke-2 */
const STEP_PROGRESS = 2 / 4
/** Cooldown default resend OTP (detik) — bila backend tidak mengirim `cooldownSeconds` */
const DEFAULT_COOLDOWN = 60

type FormError = { kind: "generic"; message: string } | null

export default function VerifyOtpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const otpRef = useRef<OtpInputHandle>(null)

  // Route params dari Register screen
  const { phoneNumber, method } = useLocalSearchParams<{
    phoneNumber: string
    method: string
  }>()

  // Validasi param — fallback ke register kalau param hilang
  useEffect(() => {
    if (!phoneNumber || !method) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.register)
    }
  }, [phoneNumber, method, router])

  const otpMethod = (method as OtpMethod) || "SMS"
  const methodLabel = otpMethod === "WHATSAPP" ? "WhatsApp" : "SMS"
  const displayPhone = phoneNumber ? formatPhoneId(phoneNumber) : ""

  const [code, setCode] = useState("")
  const [otpError, setOtpError] = useState<string | undefined>()
  const [formError, setFormError] = useState<FormError>(null)
  const [verifying, setVerifying] = useState(false)

  // Resend countdown
  const [canResend, setCanResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdownKey, setCountdownKey] = useState(0)

  const handleCodeChange = useCallback((next: string) => {
    setCode(next)
    // Hapus error saat user mengubah kode — memberi kesempatan kedua
    setOtpError(undefined)
    setFormError(null)
  }, [])

  const doVerify = useCallback(
    async (otpCode: string) => {
      if (verifying || !phoneNumber) return
      if (otpCode.length < 6) return

      setVerifying(true)
      setFormError(null)
      setOtpError(undefined)

      try {
        const result = await api.auth.verifyOtp({
          phoneNumber,
          code: otpCode,
        })

        haptic("success")

        if ("isNewUser" in result && result.isNewUser) {
          // User baru → simpan tempToken + phoneNumber → lanjut ke screen #4
          setRegistrationState({
            tempToken: result.tempToken,
            phoneNumber,
            method: otpMethod,
          })
          router.replace(ROUTES.createSecurity)
        } else {
          // User sudah punya akun → token sudah disimpan otomatis oleh auth.ts
          // → Welcome (cek izin) sebagai user lama, lalu Home.
          router.replace(ROUTES.welcome())
        }
      } catch (err) {
        haptic("error")
        // Clear code agar user bisa coba lagi tanpa perlu hapus manual
        setCode("")
        otpRef.current?.focus()

        if (isApiError(err)) {
          // Pesan yang merujuk ke "code"/"otp"/"kode" → tempel ke OtpInput
          const mentionsCode =
            err.validationMessages?.some((m) => /code|otp|kode/i.test(m)) ??
            /code|otp|kode|invalid|salah|tidak valid/i.test(err.message || "")

          if (
            (err.code === "VALIDATION" ||
              err.code === "BAD_REQUEST" ||
              err.code === "UNAUTHORIZED") &&
            mentionsCode
          ) {
            setOtpError(
              err.message || "Kode tidak valid. Periksa kembali dan coba lagi.",
            )
            return
          }

          // Rate limited → alert khusus
          if (err.code === "RATE_LIMITED") {
            setFormError({
              kind: "generic",
              message:
                err.message ||
                "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
            })
            return
          }
        }

        setFormError({ kind: "generic", message: userMessage(err) })
      } finally {
        setVerifying(false)
      }
    },
    [verifying, phoneNumber, otpMethod, router],
  )

  const handleVerify = useCallback(() => {
    void doVerify(code)
  }, [code, doVerify])

  const handleResend = useCallback(async () => {
    if (resending || !phoneNumber) return
    setResending(true)
    setFormError(null)
    setOtpError(undefined)

    try {
      const result = await api.auth.requestOtp({
        phoneNumber,
        method: otpMethod,
      })
      // Restart countdown — increment key untuk re-mount Countdown component
      setCountdownKey((k) => k + 1)
      setCanResend(false)
      // Clear code agar user memasukkan kode baru
      setCode("")
      otpRef.current?.focus()

      // Update cooldown kalau backend mengirim nilai spesifik
      // (tidak dipakai langsung, tapi bisa diperluas nanti)
      if (__DEV__ && result.cooldownSeconds) {
        console.debug("[kahade/verify-otp] cooldown dari backend:", result.cooldownSeconds)
      }
    } catch (err) {
      setFormError({ kind: "generic", message: userMessage(err) })
    } finally {
      setResending(false)
    }
  }, [resending, phoneNumber, otpMethod])

  const handleChangePhone = useCallback(() => {
    router.back()
  }, [router])

  // Jangan render kalau param tidak valid (effect akan redirect)
  if (!phoneNumber || !method) return null

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Verifikasi OTP" progress={STEP_PROGRESS} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-8">
            {/* Intro — H1 di body (Header memakai H3), jadi satu H1 per layar */}
            <View className="gap-3">
              <Heading level={1} className="text-balance">
                Masukkan kode verifikasi
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Kode 6 digit telah dikirim via {methodLabel}. Pastikan Anda
                memiliki akses ke nomor:
              </Text>
              {/* Nomor HP berdiri sendiri — data presisi (§3.1 → Mono) */}
              <Text variant="monoBody" weight={600}>
                {displayPhone}
              </Text>
            </View>

            {/* OTP Input */}
            <OtpInput
              ref={otpRef}
              length={6}
              value={code}
              onChange={handleCodeChange}
              errorText={otpError}
              helperText={otpError ? undefined : "Masukkan 6 digit kode yang diterima"}
              disabled={verifying}
              autoFocus
              accessibilityLabel="Kode verifikasi 6 digit"
            />

            {/* Tombol Verifikasi — manual submit, bukan auto */}
            <Button
              onPress={handleVerify}
              loading={verifying}
              disabled={code.length < 6}
            >
              Verifikasi
            </Button>

            {/* Error alert (non-field) */}
            {formError ? (
              <Alert
                tone="danger"
                title="Verifikasi gagal"
                onDismiss={() => setFormError(null)}
              >
                {formError.message}
              </Alert>
            ) : null}
          </View>
        </ScrollView>

        {/* Footer: countdown/resend + ubah nomor */}
        <View
          className="w-full gap-4 border-t border-border bg-background px-6 pt-4"
          style={{ paddingBottom: tokens.space[4] + insets.bottom }}
        >
          <View className="items-center">
            {canResend ? (
              <TextLink onPress={handleResend} disabled={resending}>
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
          </View>

          <Text variant="body" tone="secondary" className="text-center">
            Nomor salah?{" "}
            <TextLink inline onPress={handleChangePhone}>
              Ubah nomor HP
            </TextLink>
          </Text>
        </View>
      </KeyboardAvoiding>
    </Screen>
  )
}
