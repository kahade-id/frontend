/**
 * Kahade — Verify OTP (screen #3 alur auth): masukkan kode 6–10 digit.
 *
 * Struktur:
 *   <Header title="Verifikasi OTP" progress=2/4>
 *   H1 "Masukkan kode verifikasi" + body (penjelasan + nomor HP Mono)
 *   <OtpInput> dinamis 6–10 digit (DBL-007, mirror BE @Length(6,10))
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
 *   - Submit MANUAL via tombol, BUKAN auto-submit saat digit terisi — user
 *     punya kontrol penuh kapan kode dikirim (DBL-007: panjang dinamis
 *     6–10, auto-submit tidak tahu kapan kode selesai), dan tombol memberi
 *     target sentuh yang jelas (44px+).
 *   - Haptic feedback di momen kritikal (§8): "success" saat verifikasi
 *     berhasil, "error" saat OTP ditolak. Tidak dipakai untuk interaksi ringan.
 *   - Error dari backend dibedakan: pesan yang mengandung "code"/"otp"/"kode"
 *     ditempel ke OtpInput (errorText), sisanya ke <Alert>.
 *   - Countdown default 60 detik. Saat kirim ulang berhasil, user diarahkan
 *     ke /whatsapp-trigger (trigger baru, kode referensi baru).
 *   - tempToken disimpan di memori modul (lib/registration.ts /
 *     lib/password-reset.ts) — bukan SecureStore, bukan route params.
 *   - "Ubah nomor HP" kembali ke input nomor sesuai purpose (register →
 *     /register, login → /login, forgot_password → /forgot-password,
 *     migrate_phone → /phone-migration) — bukan router.back() buta
 *     (FE-IMP-3 #117).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { OtpInput, OTP_MIN_LENGTH, OTP_MAX_LENGTH, type OtpInputHandle } from "@/components/ui/otp-input"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
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
import { otpStepProgress } from "@/lib/auth-progress"
import { formatPhoneId } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { getAuthLocation } from "@/lib/location"
import { clearOtpFlow, getOtpFlow, patchOtpFlow } from "@/lib/otp-flow"
import { clearPasswordResetState, setPasswordResetState } from "@/lib/password-reset"
import { clearRegistrationState, setRegistrationState } from "@/lib/registration"
import { isOfflineKnown, useIsOnline } from "@/lib/connectivity"
import { ROUTES } from "@/lib/routes"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
import { useAuthSession } from "@/lib/use-auth-session"
import { useLeaveConfirm } from "@/lib/use-leave-confirm"
import { Dialog } from "@/components/ui/modal"

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
  /**
   * Verifikasi sukses & token tersimpan — navigasi ke Beranda ditunda hingga
   * session.token terpropagasi (lihat goWelcome). Mencegah layar blank akibat
   * race antara notifySession() dan router.replace().
   */
  const [loginDone, setLoginDone] = useState(false)

  // A07 (batch 139): status koneksi — verifikasi OTP butuh jaringan.
  const isOnline = useIsOnline()

  // Resend countdown
  const [canResend, setCanResend] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdownKey, setCountdownKey] = useState(0)

  // A06 (batch 139): konfirmasi bila keluar dengan kode yang belum diverifikasi.
  const leaveConfirm = useLeaveConfirm(code.length > 0 && !verifying, {
    title: "Batalkan verifikasi?",
    description:
      "Kode yang sudah Anda ketik akan hilang. Anda bisa meminta kode baru kapan saja.",
    confirmLabel: "Ya, batalkan",
  })
  const markLeaving = leaveConfirm.markLeaving

  const handleCodeChange = useCallback((next: string) => {
    setCode(next)
    // Hapus error saat user mengubah kode — memberi kesempatan kedua
    setOtpError(undefined)
    setFormError(null)
  }, [])

  const goWelcome = useCallback(() => {
    // Jangan navigasi langsung — tandai selesai; effect di bawah menunggu
    // session.token terpropagasi ke Stack.Protected guard sebelum replace.
    // Tanpa ini, router.replace("/showcase") dapat dieksekusi saat guard
    // masih null (race notifySession vs navigasi) → layar blank.
    setLoginDone(true)
  }, [])

  // Navigasi ke Beranda HANYA setelah token sesi terlihat oleh guard
  // Stack.Protected — pola sama seperti login.tsx (UX-NAV-010). Menunggu
  // fase restore lokal selesai agar tidak redirect prematur.
  const session = useAuthSession()
  useEffect(() => {
    if (loginDone && !session.restoring && session.token) {
      // U5-003 (journey): layar welcome dihapus — langsung ke Beranda.
      router.replace(ROUTES.home)
    }
  }, [loginDone, session.restoring, session.token, router])

  const doVerify = useCallback(
    async (otpCode: string) => {
      if (verifying || !phoneNumber || !purpose) return
      if (otpCode.length < OTP_MIN_LENGTH) return

      setVerifying(true)
      setFormError(null)
      setOtpError(undefined)

      // A07: gagal cepat dengan pesan jelas saat jelas offline — jangan
      // biarkan request timeout misterius.
      if (isOfflineKnown()) {
        setFormError({
          kind: "generic",
          message:
            "Tidak ada koneksi internet. Sambungkan kembali lalu coba verifikasi lagi — kode Anda tetap tersimpan di sini.",
        })
        setVerifying(false)
        return
      }

      try {
        const location = (await getAuthLocation()) ?? undefined
        const result = await api.auth.verifyOtp({
          phoneNumber,
          code: otpCode,
          location,
        })

        haptic("success")
        clearOtpFlow()
        // A06: verifikasi sukses = keluar yang disengaja.
        markLeaving()

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
            const migrationResult = await api.auth.confirmPhoneMigration({
              tempToken: result.tempToken,
              location,
            })
            // BFI-033: akun ber-2FA → tidak ada token sesi; lanjut ke /verify-2fa.
            if ("requires2FA" in migrationResult && migrationResult.requires2FA) {
              setPendingTwoFactorLogin({
                tempToken: migrationResult.tempToken,
                identifier: phoneNumber,
              })
              router.push(ROUTES.verify2fa)
              break
            }
            goWelcome()
            break
          case "existing_user":
            // BFI-032: akun ber-2FA → tempToken saja, tanpa token sesi.
            if ("requires2FA" in result && result.requires2FA) {
              setPendingTwoFactorLogin({
                tempToken: result.tempToken,
                identifier: phoneNumber,
              })
              router.push(ROUTES.verify2fa)
              break
            }
          // falls through
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
            // T4-002: jangan tampilkan err.message mentah (bisa Inggris) —
            // kode salah/kedaluwarsa selalu mendapat arahan Indonesia yang
            // menunjuk ke "Minta kode baru".
            setOtpError(
              "Kode salah atau sudah kedaluwarsa. Minta kode baru, lalu kirim pesan lagi ke WhatsApp resmi Kahade.",
            )
            return
          }

          // Rate limited → alert khusus (fail-closed Indonesia via userMessage)
          if (err.code === "RATE_LIMITED") {
            setFormError({
              kind: "generic",
              message: userMessage(err),
            })
            return
          }
        }

        setFormError({ kind: "generic", message: userMessage(err) })
      } finally {
        setVerifying(false)
      }
    },
    [verifying, phoneNumber, purpose, router, goWelcome, markLeaving],
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
    // A07: kirim ulang butuh koneksi — gagal cepat dengan pesan jelas.
    if (isOfflineKnown()) {
      setFormError({
        kind: "generic",
        message: "Tidak ada koneksi internet. Sambungkan kembali untuk meminta kode baru.",
      })
      return
    }
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
    // FE-IMP-3 #117 — kembali ke input nomor SESUAI purpose, bukan
    // router.back() buta (stack tidak terduga bila masuk via deep-link /
    // reload web). UX-only: tidak mengubah alur verifikasi.
    //
    // A08 (batch 139): "Ubah nomor HP" adalah aksi eksplisit (bukan tombol
    // kembali) — bersihkan challenge LAMA supaya kode referensi basi tidak
    // dipakai ulang, sambil mempertahankan konteks purpose. markLeaving()
    // mematikan penjaga A06 untuk navigasi yang disengaja ini.
    const migrationToken = flow?.migrationToken
    clearOtpFlow()
    markLeaving()
    switch (purpose) {
      case "register":
        router.replace(ROUTES.register)
        break
      case "login":
        router.replace(ROUTES.login)
        break
      case "forgot_password":
        router.replace(ROUTES.forgotPassword())
        break
      case "migrate_phone":
        if (migrationToken) {
          router.replace(ROUTES.phoneMigration(migrationToken))
        } else if (router.canGoBack()) {
          router.back()
        }
        break
      default:
        if (router.canGoBack()) router.back()
    }
  }, [router, purpose, flow, markLeaving])

  // Jangan render tanpa alur aktif (effect akan redirect)
  if (!flow || !phoneNumber || !purpose) return null

  return (
    // SEC-404: proteksi screen-capture iOS di layar OTP.
    <ScreenCaptureGuard>
      <Screen padded={false} edges={["top"]}>
      {/* T1-002: progress per purpose — register/forgot 3/4 (langkah "masukkan OTP"; FE-040), login/migrasi disembunyikan */}
      <Header title="Verifikasi OTP" progress={otpStepProgress(purpose, "otp")} safeArea={false} />

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
                Kode {OTP_MIN_LENGTH}–{OTP_MAX_LENGTH} digit telah dibalas via WhatsApp. Pastikan Anda
                memiliki akses ke nomor:
              </Text>
              {/* Nomor HP berdiri sendiri — data presisi (§3.1 → Mono) */}
              <Text variant="monoBody" weight={600}>
                {displayPhone}
              </Text>
            </View>

            {/* OTP Input — DBL-007: panjang dinamis 6–10 digit (mirror BE
                @Length(6,10)); helper text dinamis mengikuti rentang. */}
            <OtpInput
              ref={otpRef}
              dynamicLength
              value={code}
              onChange={handleCodeChange}
              errorText={otpError}
              helperText={otpError ? undefined : `Masukkan ${OTP_MIN_LENGTH}–${OTP_MAX_LENGTH} digit kode yang diterima`}
              disabled={verifying}
              autoFocus
              accessibilityLabel={`Kode verifikasi ${OTP_MIN_LENGTH}–${OTP_MAX_LENGTH} digit`}
            />

            {/* A07: status koneksi — bedakan offline dari menunggu */}
            {!isOnline ? (
              <Alert tone="warning" title="Anda sedang offline">
                Kode tidak bisa diverifikasi tanpa koneksi internet. Tetap di
                layar ini — kode yang sudah diketik tidak hilang.
              </Alert>
            ) : null}

            {/* Tombol Verifikasi — manual submit, bukan auto */}
            <Button
              onPress={handleVerify}
              loading={verifying}
              disabled={code.length < OTP_MIN_LENGTH}
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
          <View className="items-center gap-1">
            {canResend ? (
              <>
                <TextLink onPress={handleResend} disabled={resending || !isOnline}>
                  {resending ? "Meminta kode baru…" : "Minta kode baru"}
                </TextLink>
                {/*
                 * FE-041: label "Kirim ulang kode" menyesatkan — kode TIDAK
                 * dikirim ulang, user harus mengirim pesan pemicu lagi.
                 * Handler tidak berubah: tetap meminta kode baru via trigger.
                 */}
                {/*
                 * FE-IMP-3 #119 — jelaskan: kode baru dikirim sebagai balasan
                 * SETELAH pesan pemicu dikirim lagi (bukan OTP langsung).
                 */}
                <Text variant="caption" tone="secondary" className="text-center text-pretty">
                  Kode baru dikirim sebagai balasan setelah Anda mengirim pesan pemicu lagi ke WhatsApp resmi Kahade.
                </Text>
              </>
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

      {/* A06: dialog konfirmasi keluar — hanya bila ada kode belum diverifikasi */}
      <Dialog {...leaveConfirm.dialogProps} />
    </ScreenCaptureGuard>
  )
}
