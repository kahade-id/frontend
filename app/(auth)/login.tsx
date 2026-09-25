/**
 * Kahade — Login (screen #7 alur auth): identifier + password, atau WhatsApp.
 *
 * Struktur:
 *   <Header title="Masuk" showBack={false}>
 *   VStack gap={8}:
 *     VStack (welcome text)
 *     VStack (form fields)
 *       Input "Username / Email / Nomor HP"
 *       PasswordField (tanpa strength meter — ini login, bukan registrasi)
 *     Button "Masuk"
 *     Alert error (jika ada)
 *     Divider "atau"
 *     VStack (opsi WhatsApp)
 *       Button secondary "Masuk dengan WhatsApp" → expand PhoneInput + kirim kode
 *   VStack (footer links)
 *     TextLink "Lupa kata sandi?"
 *     Text "Belum punya akun? Daftar"
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/login  body { identifier, password, deviceId, deviceInfo?, location? }
 *   - `identifier` = username ATAU email ATAU nomor HP.
 *   - deviceId/deviceInfo auto-inject oleh withDevice() di auth.ts; `location`
 *     diisi dari getAuthLocation() (null bila izin ditolak — tidak memblokir).
 *   - Response: LoginResult = discriminated union
 *     - requiresPhoneMigration: true → { migrationToken } → /phone-migration
 *       (akun lama wajib tambah nomor HP; cabang ini TIDAK menyimpan token)
 *     - requiresTwoFactor: true → { tempToken } → /verify-2fa
 *     - sukses → { accessToken, user? } → token disimpan otomatis
 *
 * Opsi WhatsApp: requestOtpTrigger({ purpose: "login" }) → /whatsapp-trigger
 * → /verify-otp. Hasil existing_user → sesi langsung; new_user → lanjut
 * registrasi (layar buat kata sandi).
 *
 * Keputusan non-obvious:
 *   - Header TANPA back button — ini entry point untuk user yang sudah punya akun.
 *   - PasswordField TANPA showStrength — ini login, bukan registrasi.
 *   - `offset` KeyboardAvoiding = inset atas + tinggi Header, sama seperti
 *     layar registrasi.
 *   - 2FA: requiresTwoFactor → tempToken + identifier di memori
 *     (lib/two-factor-login) → /verify-2fa (push, bukan replace).
 *   - Migrasi: requiresPhoneMigration → migrationToken lewat param route ke
 *     /phone-migration (short-lived, satu alur).
 *   - CAPTCHA: backend hanya mewajibkannya setelah 3 login gagal dari IP yang
 *     sama dan menolak dengan 401 `CAPTCHA_REQUIRED`. Layar memuat tantangan
 *     secara LAZY — hanya saat backend benar-benar memintanya.
 *   - Tombol "Masuk" disabled selama submit untuk mencegah double-submit.
 *   - Setelah login berhasil → /welcome (cek permissions; bukan user baru).
 */
import { useCallback, useRef, useState } from "react"
import { Platform, ScrollView, TextInput, View } from "react-native"

import { CaptchaSlider } from "@/components/ui/captcha-slider"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { WhatsappLogo } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Divider } from "@/components/ui/divider"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PasswordField } from "@/components/ui/password-field"
import { isValidPhoneId, PhoneInput, toE164Id } from "@/components/ui/phone-input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import type { CaptchaChallenge } from "@/lib/api/auth"
import { CAPTCHA_MESSAGES } from "@/lib/captcha-messages"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { getAuthLocation } from "@/lib/location"
import { setPendingNext } from "@/lib/login-redirect"
import { setOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // `next` dipasang oleh layar ajakan login (guest mode web): kembali ke
  // tujuan setelah login berhasil.
  const { next } = useLocalSearchParams<{ next?: string }>()
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : undefined

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Opsi WhatsApp: expand inline di bawah form password.
  const [waExpanded, setWaExpanded] = useState(false)
  const [waDigits, setWaDigits] = useState("")
  const [waPhoneError, setWaPhoneError] = useState<string | undefined>()
  const [waSubmitting, setWaSubmitting] = useState(false)
  const waPhoneRef = useRef<TextInput>(null)

  // Captcha hanya muncul bila backend memintanya (3+ login gagal per IP).
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState<string | null>(null)

  const isFormValid = identifier.trim().length > 0 && password.length > 0

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    setCaptchaError(null)
    setCaptchaAnswer(null)
    try {
      setChallenge(await api.auth.generateCaptcha())
    } catch (err) {
      setChallenge(null)
      setCaptchaError(userMessage(err))
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  const goAfterLogin = useCallback(() => {
    // Web guest mode tidak memakai layar Welcome/splash: langsung kembali
    // ke tujuan (atau Beranda). Native tetap melalui Welcome (izin push).
    if (Platform.OS === "web") {
      router.replace((nextPath as never) ?? ROUTES.home)
      return
    }
    // Login berhasil → welcome screen (cek permissions). Bukan user baru.
    router.replace(ROUTES.welcome())
  }, [router, nextPath])

  const handleLogin = useCallback(async () => {
    if (submitting || !isFormValid) return
    setSubmitting(true)
    setFormError(null)
    setPendingNext(nextPath)

    try {
      const result = await api.auth.login({
        identifier: identifier.trim(),
        password,
        // Dikirim hanya bila tantangan sudah dimuat — backend mengabaikannya
        // selama captcha belum diwajibkan untuk IP ini.
        captchaId: challenge?.captchaId,
        captchaAnswer: captchaAnswer ?? undefined,
        // Lokasi opsional untuk keamanan akun; null = lanjut tanpa lokasi.
        location: (await getAuthLocation()) ?? undefined,
      })

      if ("requiresPhoneMigration" in result && result.requiresPhoneMigration) {
        // Akun lama belum punya nomor HP → wajib migrasi. migrationToken
        // short-lived untuk satu alur ini.
        router.replace(ROUTES.phoneMigration(result.migrationToken))
        return
      }

      if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
        // Akun memakai TOTP → simpan tempToken di memori, lanjut ke layar kode.
        // `push` (bukan replace) supaya tombol kembali membawa ke form login.
        setPendingTwoFactorLogin({ tempToken: result.tempToken, identifier: identifier.trim() })
        router.push(ROUTES.verify2fa)
        return
      }

      goAfterLogin()
    } catch (err) {
      if (isApiError(err)) {
        /*
         * Captcha diminta backend (3+ kegagalan dari IP ini). Tantangan lama
         * yang gagal/kedaluwarsa tidak bisa dipakai ulang — backend menghapus
         * kuncinya setelah verifikasi pertama (Redis `del`).
         */
        const captchaCode = err.backendCode ?? ""
        if (
          captchaCode === "CAPTCHA_REQUIRED" ||
          captchaCode === "CAPTCHA_FAILED" ||
          captchaCode === "CAPTCHA_EXPIRED"
        ) {
          // Selalu tantangan baru: backend menghapus kunci setelah verifikasi
          // pertama, jadi tantangan lama tidak mungkin dipakai ulang.
          void loadCaptcha()
          setFormError(CAPTCHA_MESSAGES.loginRequired)
          return
        }
        // Invalid credentials
        if (err.code === "UNAUTHORIZED") {
          setFormError("Username, email, atau kata sandi salah. Periksa kembali dan coba lagi.")
          return
        }
        // Rate limited
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
        // Validation error
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          setFormError(err.message || "Data tidak valid. Periksa kembali data masuk Anda.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, isFormValid, identifier, password, router, nextPath, challenge, captchaAnswer, loadCaptcha, goAfterLogin])

  const handleWhatsappLogin = useCallback(async () => {
    if (waSubmitting) return
    setWaPhoneError(undefined)
    setFormError(null)

    if (!isValidPhoneId(waDigits)) {
      setWaPhoneError(
        waDigits.length === 0
          ? "Nomor HP wajib diisi."
          : "Nomor HP tidak valid. Gunakan nomor Indonesia yang diawali 8, 9–12 digit.",
      )
      waPhoneRef.current?.focus()
      return
    }

    const phoneNumber = toE164Id(waDigits)
    setWaSubmitting(true)
    try {
      const trigger = await api.auth.requestOtpTrigger({
        phoneNumber,
        purpose: "login",
        location: (await getAuthLocation()) ?? undefined,
      })
      // State alur di memori modul (B-07/B-14): nomor + refCode tidak lewat URL.
      setOtpFlow({
        phoneNumber,
        purpose: "login",
        refCode: trigger.refCode,
        whatsappUrl: trigger.whatsappUrl,
        triggerText: trigger.triggerText,
        expiresAt: trigger.expiresAt,
      })
      router.push(ROUTES.whatsappTrigger)
    } catch (err) {
      if (isApiError(err)) {
        // 404 = nomor belum terdaftar → arahkan ke registrasi (jalan keluar
        // yang benar, bukan mengulang request).
        if (err.code === "NOT_FOUND") {
          setFormError("Nomor HP ini belum terdaftar. Silakan daftar akun baru terlebih dahulu.")
          return
        }
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setWaSubmitting(false)
    }
  }, [waSubmitting, waDigits, router])

  const handleForgotPassword = useCallback(() => {
    router.push(ROUTES.forgotPassword())
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
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* v2: form reveal satu kesatuan (fast) — form auth adalah satu unit
              tugas; stagger per-field justru mengganggu fokus baca. */}
          <FadeIn duration="fast">
          <VStack gap={8}>
            {/* Welcome text */}
            <VStack gap={2}>
              <Heading level={1} className="text-balance">
                Selamat datang kembali
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Masuk ke akun Kahade Anda untuk melanjutkan.
              </Text>
            </VStack>

            {/* Form fields */}
            <VStack gap={4}>
              <Input
                label="Username / Email / Nomor HP"
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t)
                  setFormError(null)
                }}
                helperText="Contoh: johndoe, nama@email.com, atau 0812xxxxxxx"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                autoFocus
                required
                returnKeyType="next"
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
              ) : null}
            </VStack>

            {/* Submit button */}
            <Button
              onPress={() => void handleLogin()}
              loading={submitting}
              disabled={!isFormValid || (challenge !== null && captchaAnswer === null)}
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

            {/* Opsi kedua: masuk dengan WhatsApp (OTP, tanpa password) */}
            <Divider label="atau" />
            <VStack gap={4}>
              {!waExpanded ? (
                <Button
                  variant="secondary"
                  leftIcon={WhatsappLogo}
                  onPress={() => setWaExpanded(true)}
                  disabled={submitting}
                >
                  Masuk dengan WhatsApp
                </Button>
              ) : (
                <VStack gap={4}>
                  <PhoneInput
                    accessibilityLabel="Nomor HP Indonesia"
                    ref={waPhoneRef}
                    value={waDigits}
                    onChangeText={(t) => {
                      setWaDigits(t)
                      setWaPhoneError(undefined)
                      setFormError(null)
                    }}
                    errorText={waPhoneError}
                    reserveHelperSpace
                    required
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => void handleWhatsappLogin()}
                    disabled={waSubmitting}
                  />
                  <Button
                    onPress={() => void handleWhatsappLogin()}
                    loading={waSubmitting}
                    leftIcon={WhatsappLogo}
                  >
                    Kirim kode via WhatsApp
                  </Button>
                  <Text variant="caption" tone="secondary" className="text-pretty">
                    Kami akan meminta Anda mengirim pesan ke WhatsApp resmi
                    Kahade, lalu membalas kode verifikasi 6 digit.
                  </Text>
                </VStack>
              )}
            </VStack>
          </VStack>
          </FadeIn>
        </ScrollView>

        {/* Footer links */}
        <FooterBar>
          <View className="items-center">
            <TextLink onPress={handleForgotPassword} disabled={submitting}>
              Lupa kata sandi?
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
