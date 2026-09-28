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
import { useCallback, useEffect, useRef, useState } from "react"
import { Platform, ScrollView, TextInput, View } from "react-native"

import { CaptchaSlider } from "@/components/ui/captcha-slider"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { WhatsappLogo, Fingerprint } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { clearLoginIdentifier, getLoginIdentifier, setLoginIdentifier } from "@/lib/login-identifier"
import { setPendingNext } from "@/lib/login-redirect"
import { setOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"
import { setPendingSocialSignup } from "@/lib/social-signup"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
import { Dialog } from "@/components/ui/modal"
import { SocialLoginButtons, type SocialOutcome } from "@/components/auth/social-login-buttons"
import {
  getPasskeyCapabilitySync,
  startPasskeyAuthentication,
  type AuthenticationOptionsJSON,
  PasskeyError,
} from "@/lib/passkey"
import { PASSKEY_COPY } from "@/lib/passkey-instructions"

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // `next` dipasang oleh layar ajakan login (guest mode web): kembali ke
  // tujuan setelah login berhasil.
  const { next } = useLocalSearchParams<{ next?: string }>()
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : undefined

  // A01 (batch 139): identifier non-rahasia dipertahankan selama sesi
  // formulir — pulihkan dari penyimpanan sesi bila layar me-remount
  // (mis. kembali dari tautan bantuan "Lupa kata sandi?").
  const [identifier, setIdentifier] = useState(() => getLoginIdentifier())
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // FE-IMP-3 #114 — hitung kegagalan login (kata sandi) per instance layar.
  // Setelah 2 kegagalan, "Lupa kata sandi?" tampil DEKAT error. Murni state
  // UI: tidak mengubah request, captcha, atau rate-limit.
  const [failCount, setFailCount] = useState(0)

  // Opsi WhatsApp: expand inline di bawah form password.
  const [waExpanded, setWaExpanded] = useState(false)
  const [waDigits, setWaDigits] = useState("")
  const [waPhoneError, setWaPhoneError] = useState<string | undefined>()
  const [waSubmitting, setWaSubmitting] = useState(false)
  const waPhoneRef = useRef<TextInput>(null)
  // FRM-004: rantai fokus identifier -> password.
  const passwordRef = useRef<TextInput>(null)

  // Captcha hanya muncul bila backend memintanya (3+ login gagal per IP).
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState<string | null>(null)

  // Passkey (GAP-A G033): alur penuh hanya di web; native menampilkan info.
  const passkeySupported = getPasskeyCapabilitySync().supported
  const [pkSubmitting, setPkSubmitting] = useState(false)
  const [pkNativeInfo, setPkNativeInfo] = useState(false)

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
    // A01: sesi formulir selesai → identifier tidak perlu dipertahankan.
    clearLoginIdentifier()
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
        setFailCount(0)
        router.replace(ROUTES.phoneMigration(result.migrationToken))
        return
      }

      if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
        // Akun memakai TOTP → simpan tempToken di memori, lanjut ke layar kode.
        // `push` (bukan replace) supaya tombol kembali membawa ke form login.
        setFailCount(0)
        setPendingTwoFactorLogin({ tempToken: result.tempToken, identifier: identifier.trim() })
        router.push(ROUTES.verify2fa)
        return
      }

      setFailCount(0)
      goAfterLogin()
    } catch (err) {
      // FE-IMP-3 #114 — semua jalan keluar catch = satu kegagalan login.
      setFailCount((c) => c + 1)
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

  // ── Passkey (GAP-A G033/G041): masuk tanpa kata sandi ───────────────
  //
  // Terpisah visual dari "kunci biometrik perangkat" (app-lock lokal, bukan
  // metode masuk — lihat lib/biometrics.ts). Alur penuh hanya di web karena
  // WebAuthn adalah API browser; di native tombol menampilkan penjelasan
  // jujur (PASSKEY_COPY.loginNativeInfo), bukan klaim palsu.

  const finishPasskeyLogin = useCallback(
    async (challengeId: string, assertion: unknown) => {
      const result = await api.passkey.verifyAuthLogin({ challengeId, assertion })
      if ("requiresPhoneMigration" in result && result.requiresPhoneMigration) {
        router.replace(ROUTES.phoneMigration(result.migrationToken))
        return
      }
      if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
        // Passkey TIDAK menggantikan 2FA aktif: lanjut ke layar kode (G027).
        setPendingTwoFactorLogin({ tempToken: result.tempToken, identifier: identifier.trim() })
        router.push(ROUTES.verify2fa)
        return
      }
      goAfterLogin()
    },
    [router, identifier, goAfterLogin],
  )

  const handlePasskeyLogin = useCallback(async () => {
    if (pkSubmitting) return
    if (!passkeySupported) {
      setPkNativeInfo(true)
      return
    }
    setPkSubmitting(true)
    setFormError(null)
    setPendingNext(nextPath)
    try {
      const trimmed = identifier.trim()
      const { challengeId, options } = await api.passkey.getAuthOptions(
        trimmed ? { username: trimmed } : {},
      )
      const assertion = await startPasskeyAuthentication(options as AuthenticationOptionsJSON)
      await finishPasskeyLogin(challengeId, assertion)
    } catch (err) {
      if (err instanceof PasskeyError) {
        // Pembatalan oleh user = diam; masalah lain tampil sebagai error form.
        if (err.code !== "CANCELLED") setFormError(err.message)
        return
      }
      if (isApiError(err)) {
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          setFormError(err.message || "Data tidak valid. Periksa kembali data masuk Anda.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setPkSubmitting(false)
    }
  }, [pkSubmitting, passkeySupported, identifier, nextPath, finishPasskeyLogin])

  // ── Social login (GAP-A G001–G025): Google / Apple ──────────────────────
  // Hasil dinormalisasi oleh api.social.socialLogin; token sesi sudah
  // disimpan otomatis bila kind === "session".
  const handleSocialOutcome = useCallback(
    (outcome: SocialOutcome) => {
      setFormError(null)
      if (outcome.kind === "session") {
        goAfterLogin()
        return
      }
      if (outcome.kind === "twoFactor") {
        setPendingTwoFactorLogin({ tempToken: outcome.tempToken, identifier: "" })
        router.push(ROUTES.verify2fa)
        return
      }
      if (outcome.kind === "phoneMigration") {
        router.replace(ROUTES.phoneMigration(outcome.migrationToken))
        return
      }
      if (outcome.kind === "linkRequired") {
        // Identitas sosial baru: registrasi TETAP nomor HP + OTP WhatsApp.
        // linkToken dibawa (memori modul) ke phone-register untuk ditautkan
        // setelah nomor terverifikasi.
        setPendingSocialSignup(outcome.linkToken)
        router.push(ROUTES.register)
        return
      }
      // Konflik email: buktikan kepemilikan akun lama sebelum menautkan.
      router.push(
        ROUTES.socialLinkConfirm({
          linkToken: outcome.linkToken,
          maskedEmail: outcome.maskedEmail,
          provider: outcome.provider,
        }),
      )
    },
    [goAfterLogin, router],
  )

  // Autofill passkey (conditional mediation, web saja — G041/G043): browser
  // menampilkan saran passkey di kolom username tanpa dialog modal.
  // Kegagalan di sini selalu diam — ini fitur opsional, bukan alur utama.
  useEffect(() => {
    if (Platform.OS !== "web" || !passkeySupported) return
    let cancelled = false
    void (async () => {
      try {
        const { getPasskeyCapability } = await import("@/lib/passkey")
        if (!(await getPasskeyCapability()).conditionalMediation) return
        const { challengeId, options } = await api.passkey.getAuthOptions()
        const assertion = await startPasskeyAuthentication(
          options as AuthenticationOptionsJSON,
          { conditional: true },
        )
        if (cancelled) return
        await finishPasskeyLogin(challengeId, assertion)
      } catch {
        // Diam: autofill opsional; user tetap bisa menekan tombol passkey.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [passkeySupported, finishPasskeyLogin])

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
        // Defensif: endpoint /v1/auth/otp-trigger tidak melempar 404 —
        // nomor yang belum terdaftar mendapat trigger asli dan mengalir ke
        // registrasi (status new_user di /verify-otp). Cabang ini
        // dipertahankan bila kontrak berubah.
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
                  // A01: simpan identifier non-rahasia selama sesi formulir.
                  setIdentifier(t)
                  setLoginIdentifier(t)
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
                // FRM-004: Next memindahkan fokus ke field kata sandi.
                onSubmitEditing={() => passwordRef.current?.focus()}
                disabled={submitting}
              />

              {/* Label default PasswordField = "Kata sandi" — konsisten dengan alur registrasi */}
              <PasswordField
                ref={passwordRef}
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

            {/*
             * FE-IMP-3 #114 — setelah 2 kegagalan, tampilkan "Lupa kata
             * sandi?" DEKAT error (bukan cuma di footer bawah).
             */}
            {formError && failCount >= 2 ? (
              <View className="items-center">
                <TextLink onPress={handleForgotPassword} disabled={submitting}>
                  Lupa kata sandi?
                </TextLink>
              </View>
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

            {/* Opsi ketiga: passkey (GAP-A G033). Terpisah visual dari kunci
                biometrik perangkat (app-lock lokal — bukan metode masuk). */}
            <Divider label="atau" />
            <VStack gap={2}>
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Button
                    variant="secondary"
                    leftIcon={Fingerprint}
                    onPress={() => void handlePasskeyLogin()}
                    loading={pkSubmitting}
                    disabled={submitting || waSubmitting}
                  >
                    {PASSKEY_COPY.loginButton}
                  </Button>
                </View>
                {/*
                 * FE-IMP-3 #115 — badge "Web saja" tampil SEBELUM tombol
                 * ditekan: passkey penuh hanya didukung di web (G033).
                 */}
                <Badge tone="neutral" variant="outline">
                  Web saja
                </Badge>
              </View>
              {passkeySupported ? (
                <Text variant="caption" tone="secondary" className="text-pretty">
                  {PASSKEY_COPY.loginHintWeb}
                </Text>
              ) : (
                <Text variant="caption" tone="secondary" className="text-pretty">
                  Passkey tersedia di web — ketuk untuk info selengkapnya.
                </Text>
              )}
            </VStack>

            {/* Opsi keempat: login sosial Google / Apple (GAP-A G001–G025).
                Tombol hanya tampil bila server mengonfirmasi provider tersedia
                (GET /v1/auth/social/providers). Registrasi tetap nomor HP:
                identitas baru diarahkan daftar nomor HP dulu. */}
            <Divider label="atau" />
            <SocialLoginButtons
              onBeforeStart={() => setPendingNext(nextPath)}
              onOutcome={handleSocialOutcome}
              onError={(msg) => setFormError(`Login sosial gagal: ${msg}`)}
            />
          </VStack>
          </FadeIn>
        </ScrollView>

        {/* Info jujur untuk native: passkey penuh hanya di web (G033) */}
        <Dialog
          visible={pkNativeInfo}
          onRequestClose={() => setPkNativeInfo(false)}
          title={PASSKEY_COPY.loginNativeInfo.title}
          description={PASSKEY_COPY.loginNativeInfo.body}
          confirmLabel="Mengerti"
          hideCancel
          onConfirm={() => setPkNativeInfo(false)}
        />

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

          {/* GAP-A (G052): pemulihan akun dalam masa tenggang penghapusan. */}
          <View className="items-center">
            <TextLink onPress={() => router.push(ROUTES.deletionStatus)} disabled={submitting}>
              Akun dihapus? Pulihkan di sini
            </TextLink>
          </View>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
