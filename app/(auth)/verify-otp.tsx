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
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/verify-otp  body { phoneNumber, code, deviceId, deviceInfo?, location? }
 *   - `deviceId` + `deviceInfo` DIINJEKSI OTOMATIS oleh `withDevice()` di auth.ts;
 *     `location` dari getAuthLocation() (null = lanjut tanpa lokasi).
 *   - Response: status eksplisit —
 *       • new_user          → { tempToken } → simpan di registration state
 *                             → /register-security (buat kata sandi)
 *       • existing_user     → { accessToken } → token disimpan otomatis
 *                             → welcome
 *       • password_reset    → { tempToken } → simpan di password-reset state
 *                             → /reset-password
 *       • migration_verified→ { tempToken } → confirmPhoneMigration()
 *                             → sesi penuh → welcome
 *
 * Kirim ulang: OTP HANYA via WhatsApp customer-initiated — resend = trigger
 * BARU via requestOtpTrigger(purpose yang sama) → kembali ke /whatsapp-trigger
 * (user mengirim pesan pemicu lagi). TIDAK ADA jalur kirim langsung.
 *
 * State alur (nomor + purpose + migrationToken) hidup di memori modul
 * (lib/otp-flow) — BUKAN route params (B-07/B-14).
 *
 * Keputusan non-obvious:
 *   - Submit MANUAL via tombol, BUKAN auto-submit saat 6 digit terisi — user
 *     punya kontrol penuh kapan kode dikirim, dan tombol memberi target sentuh
 *     yang jelas (44px+).
 *   - Haptic feedback di momen kritikal (§8): "success" saat verifikasi
 *     berhasil, "error" saat OTP ditolak. Tidak dipakai untuk interaksi ringan.
 *   - Error dari backend dibedakan: pesan yang mengandung "code"/"otp"/"kode"
 *     ditempel ke OtpInput (errorText), sisanya ke <Alert>.
 *   - Countdown default 60 detik. Saat kirim ulang berhasil, user diarahkan
 *     ke /whatsapp-trigger (trigger baru, kode referensi baru).
 *   - tempToken disimpan di memori modul (lib/registration.ts /
 *     lib/password-reset.ts) — bukan SecureStore, bukan route params.
 *   - "Ubah nomor HP" = `router.back()` ke layar asal.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Platform, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { OtpInput, type OtpInputHandle } from "@/components/ui/otp-input"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/ui/countdown"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { api, isApiError, userMessage } from "@/lib/api"
import { formatPhoneId } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { getAuthLocation } from "@/lib/location"
import { clearOtpFlow, getOtpFlow, patchOtpFlow } from "@/lib/otp-flow"
import { clearPasswordResetState, setPasswordResetState } from "@/lib/password-reset"
import { clearRegistrationState, setRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"

/** Progress: registrasi via HP = 4 langkah, ini langkah ke-2 */
const STEP_PROGRESS = 2 / 4
/** Cooldown default kirim ulang (detik) */
const DEFAULT_COOLDOWN = 60

type FormError = { kind: "generic"; message: string } | null

export default function VerifyOtpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const otpRef = useRef<OtpInputHandle>(null)

  /**
   * State alur dari layar asal (lib/otp-flow, memori modul).
   * Dibaca SEKALI saat mount: tanpa alur (deep-link/reload web langsung ke
   * /verify-otp) layar ini tidak bisa dipakai standalone — B-14.
   */
  const flowRef = useRef(getOtpFlow())
  const flow = flowRef.current
  const phoneNumber = flow?.phoneNumber
  const purpose = flow?.purpose

  // Tanpa alur aktif → kembali ke awal (OTP baru).
  useEffect(() => {
    if (!flow) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.register)
    }
  }, [flow, router])

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

  const goWelcome = useCallback(() => {
    // Web guest mode: langsung ke Beranda; native: Welcome (cek permissions).
    if (Platform.OS === "web") router.replace(ROUTES.home)
    else router.replace(ROUTES.welcome())
  }, [router])

  const doVerify = useCallback(
    async (otpCode: string) => {
      if (verifying || !phoneNumber || !purpose) return
      if (otpCode.length < 6) return

      setVerifying(true)
      setFormError(null)
      setOtpError(undefined)

      try {
        const location = (await getAuthLocation()) ?? undefined
        const result = await api.auth.verifyOtp({
          phoneNumber,
          code: otpCode,
          location,
        })

        haptic("success")
        clearOtpFlow()

        switch (result.status) {
          case "new_user":
            // Belum punya akun (registrasi / login-WA dengan nomor baru) →
            // lanjut buat kata sandi + data diri.
            clearPasswordResetState()
            setRegistrationState({ tempToken: result.tempToken, phoneNumber })
            router.replace(ROUTES.registerSecurity)
            break
          case "password_reset":
            // Lupa kata sandi → lanjut buat kata sandi baru.
            clearRegistrationState()
            setPasswordResetState({ tempToken: result.tempToken, phoneNumber })
            router.replace(ROUTES.resetPassword())
            break
          case "migration_verified":
            // Migrasi nomor HP → tukar tempToken jadi sesi penuh.
            clearRegistrationState()
            clearPasswordResetState()
            await api.auth.confirmPhoneMigration({
              tempToken: result.tempToken,
              location,
            })
            goWelcome()
            break
          case "existing_user":
          default:
            // Token sudah disimpan otomatis oleh auth.ts → masuk app.
            clearRegistrationState()
            clearPasswordResetState()
            goWelcome()
            break
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
    [verifying, phoneNumber, purpose, router, goWelcome],
  )

  const handleVerify = useCallback(() => {
    void doVerify(code)
  }, [code, doVerify])

  /**
   * Kirim ulang = trigger WhatsApp BARU (customer-initiated). Tidak ada jalur
   * kirim langsung — user kembali ke /whatsapp-trigger dan mengirim pesan
   * pemicu lagi dengan kode referensi yang baru.
   */
  const handleResend = useCallback(async () => {
    if (resending || !phoneNumber || !purpose) return
    setResending(true)
    setFormError(null)
    setOtpError(undefined)

    try {
      const trigger = await api.auth.requestOtpTrigger({
        phoneNumber,
        purpose,
        migrationToken: flow?.migrationToken,
        location: (await getAuthLocation()) ?? undefined,
      })
      patchOtpFlow({
        refCode: trigger.refCode,
        whatsappUrl: trigger.whatsappUrl,
        triggerText: trigger.triggerText,
        expiresAt: trigger.expiresAt,
      })
      setCountdownKey((k) => k + 1)
      setCanResend(false)
      setCode("")
      router.replace(ROUTES.whatsappTrigger)
    } catch (err) {
      setFormError({ kind: "generic", message: userMessage(err) })
    } finally {
      setResending(false)
    }
  }, [resending, phoneNumber, purpose, flow, router])

  const handleChangePhone = useCallback(() => {
    router.back()
  }, [router])

  // Jangan render tanpa alur aktif (effect akan redirect)
  if (!flow || !phoneNumber || !purpose) return null

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Verifikasi OTP" progress={STEP_PROGRESS} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* v2: form reveal satu kesatuan (fast) — pola yang sama di semua
              layar auth; FooterBar di bawah tetap statis. */}
          <FadeIn duration="fast">
          <View className="gap-8">
            {/* Intro — H1 di body (Header memakai H3), jadi satu H1 per layar */}
            <View className="gap-3">
              <Heading level={1} className="text-balance">
                Masukkan kode verifikasi
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Kode 6 digit telah dibalas via WhatsApp. Pastikan Anda
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
          </FadeIn>
        </ScrollView>

        {/* Footer: countdown/resend + ubah nomor */}
        <FooterBar>
          <View className="items-center">
            {canResend ? (
              <TextLink onPress={handleResend} disabled={resending}>
                {resending ? "Meminta kode baru…" : "Kirim ulang kode"}
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
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
