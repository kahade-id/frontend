/**
 * Password login for one credential type at a time (email OR username).
 * Keeps credential validation, CAPTCHA, 2FA, migration and optional passkey
 * behavior together instead of branching through the login route.
 */
import { useCallback, useRef, useState } from "react"
import { View, type TextInputInstance } from "react-native"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CaptchaSlider } from "@/components/ui/captcha-slider"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import type { CaptchaChallenge } from "@/lib/api/auth"
import { CAPTCHA_MESSAGES } from "@/lib/captcha-messages"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { getAuthLocation } from "@/lib/location"
import { getLoginIdentifier, setLoginIdentifier } from "@/lib/login-identifier"
import { validateLoginIdentifier, type PasswordLoginMethod } from "@/lib/login-method-validation"
import { ROUTES } from "@/lib/routes"
import { setPendingMigrationToken } from "@/lib/phone-migration-token"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"
import { useLoginNavigation } from "@/components/auth/use-login-navigation"
import { usePasskeyLogin } from "@/components/auth/use-passkey-login"

type Props = {
  method: PasswordLoginMethod
  nextPath?: string
}

type PasswordAuthResult = Awaited<ReturnType<typeof api.auth.login>>

export function LoginPasswordForm({ method, nextPath }: Props) {
  const { router, beginLogin, finishLogin } = useLoginNavigation(nextPath)
  const [identifier, setIdentifier] = useState(() => getLoginIdentifier(method))
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [identifierTouched, setIdentifierTouched] = useState(false)
  const [loginAttempted, setLoginAttempted] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const passwordRef = useRef<TextInputInstance>(null)

  const identifierValidation = validateLoginIdentifier(method, identifier)
  const identifierError = identifierTouched || loginAttempted ? identifierValidation ?? undefined : undefined
  const canAttempt = identifier.trim().length > 0 && password.length > 0
  const isFormValid = identifierValidation === null && password.length > 0
  const captchaBlocksLogin =
    captchaRequired && (captchaLoading || challenge === null || captchaAnswer === null)
  /**
   * Mediasi conditional passkey (G041/G043) tetap di halaman ini: hanya di
   * samping kolom kredensial browser bisa menawarkan passkey sebagai saran
   * otomatis. Tombol passkey eksplisit hidup di hub `/login` — bukan di sini,
   * supaya satu halaman = satu metode.
   */
  usePasskeyLogin({ nextPath, conditional: true })

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    setCaptchaError(null)
    setCaptchaAnswer(null)
    setChallenge(null)
    try {
      setChallenge(await api.auth.generateCaptcha())
      setFormError(null)
    } catch {
      // Keep login fail-closed and show an explicit retry instead of a hidden
      // errorText on the slider that cannot render without a challenge.
      setChallenge(null)
      setFormError(null)
      setCaptchaError(CAPTCHA_MESSAGES.unavailable)
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  const finishCredentialLogin = useCallback(
    async (result: PasswordAuthResult, trimmedIdentifier: string) => {
      setCaptchaRequired(false)
      setChallenge(null)
      setCaptchaAnswer(null)
      if ("requiresPhoneMigration" in result && result.requiresPhoneMigration) {
        setFailCount(0)
        setPendingMigrationToken(result.migrationToken)
        router.replace(ROUTES.phoneMigration())
        return
      }
      if (
        ("requires2FA" in result && result.requires2FA) ||
        ("requiresTwoFactor" in result && result.requiresTwoFactor)
      ) {
        setFailCount(0)
        setPendingTwoFactorLogin({ tempToken: result.tempToken, identifier: trimmedIdentifier })
        router.push(ROUTES.verify2fa)
        return
      }
      setFailCount(0)
      await finishLogin()
    },
    [finishLogin, router],
  )

  const handleLogin = useCallback(async () => {
    setLoginAttempted(true)
    if (!isFormValid || submitting || captchaBlocksLogin) return

    const trimmedIdentifier = identifier.trim()
    setSubmitting(true)
    setFormError(null)
    beginLogin()
    try {
      const result = await api.auth.login({
        identifier: trimmedIdentifier,
        password,
        // Backend only requires the slider after its failed-attempt threshold.
        captchaId: challenge?.captchaId,
        captchaAnswer: captchaAnswer ?? undefined,
        // Optional security metadata: denied location permission never blocks login.
        location: (await getAuthLocation()) ?? undefined,
      })
      await finishCredentialLogin(result, trimmedIdentifier)
    } catch (err) {
      setFailCount((count) => count + 1)
      if (isApiError(err)) {
        const captchaCode = err.backendCode ?? ""
        if (["CAPTCHA_REQUIRED", "CAPTCHA_FAILED", "CAPTCHA_EXPIRED"].includes(captchaCode)) {
          setCaptchaRequired(true)
          setFormError(
            captchaCode === "CAPTCHA_FAILED"
              ? CAPTCHA_MESSAGES.failed
              : captchaCode === "CAPTCHA_EXPIRED"
                ? CAPTCHA_MESSAGES.expired
                : CAPTCHA_MESSAGES.loginRequired,
          )
          void loadCaptcha()
          return
        }
        if (err.code === "UNAUTHORIZED") {
          setFormError("Email, username, atau kata sandi salah. Periksa kembali dan coba lagi.")
          return
        }
        if (err.code === "ACCOUNT_LOCKED") {
          const remaining = (err as { lockoutRemainingSeconds?: number }).lockoutRemainingSeconds
          const minutes = remaining ? Math.ceil(remaining / 60) : null
          setFormError(
            minutes
              ? `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`
              : "Akun terkunci sementara karena terlalu banyak percobaan gagal. Tunggu beberapa saat sebelum mencoba lagi.",
          )
          return
        }
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          setFormError(userMessage(err))
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [
    isFormValid,
    submitting,
    captchaBlocksLogin,
    identifier,
    beginLogin,
    password,
    challenge,
    captchaAnswer,
    finishCredentialLogin,
    loadCaptcha,
  ])

  const forgotPassword = useCallback(() => {
    router.push(ROUTES.forgotPassword())
  }, [router])

  const emailMode = method === "email"

  return (
    <VStack gap={4}>
      <VStack gap={4}>
        <Input
          label={emailMode ? "Email" : "Username"}
          value={identifier}
          onChangeText={(value) => {
            setIdentifier(value)
            setLoginIdentifier(value, method)
            setFormError(null)
          }}
          onBlur={() => setIdentifierTouched(true)}
          helperText={emailMode ? "Gunakan email yang terdaftar." : "Username tidak memakai spasi atau karakter @."}
          errorText={identifierError}
          placeholder={emailMode ? "contoh@email.com" : "contoh: johndoe"}
          keyboardType={emailMode ? "email-address" : undefined}
          inputMode={emailMode ? "email" : undefined}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={emailMode ? "email" : "username"}
          textContentType={emailMode ? "emailAddress" : "username"}
          required
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          disabled={submitting}
        />
        <PasswordField
          ref={passwordRef}
          value={password}
          onChangeText={(value) => {
            setPassword(value)
            setFormError(null)
          }}
          required
          returnKeyType="done"
          onSubmitEditing={() => void handleLogin()}
          maxLength={PASSWORD_MAX}
          disabled={submitting}
        />

        {failCount === 2 && challenge === null && !captchaLoading ? (
          <Text variant="caption" tone="secondary">
            Satu percobaan lagi sebelum verifikasi tambahan.
          </Text>
        ) : null}

        {captchaRequired && captchaLoading && challenge === null ? (
          <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            Memuat verifikasi keamanan…
          </Text>
        ) : null}

        {captchaRequired && captchaError ? (
          <Alert
            tone="warning"
            action={
              <TextLink
                onPress={() => void loadCaptcha()}
                disabled={captchaLoading}
              >
                Coba lagi
              </TextLink>
            }
          >
            {captchaError}
          </Alert>
        ) : null}

        {challenge ? (
          <VStack gap={2}>
            <Text variant="caption" tone="secondary">
              Demi keamanan, verifikasi tambahan diperlukan setelah beberapa percobaan gagal.
            </Text>
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
          </VStack>
        ) : null}
      </VStack>

      {formError ? (
        <Alert tone="danger" title="Gagal masuk" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      ) : null}

      {challenge !== null && captchaAnswer === null ? (
        <Text variant="caption" tone="secondary" className="text-center">
          Selesaikan verifikasi di atas untuk melanjutkan.
        </Text>
      ) : null}
      <Button
        onPress={() => void handleLogin()}
        loading={submitting}
        disabled={!canAttempt || captchaBlocksLogin || (challenge !== null && captchaAnswer === null)}
      >
        Masuk
      </Button>

      <Text variant="caption" tone="secondary" className="text-center text-pretty">
        Demi keamanan, lokasi perangkat dapat dicatat jika Anda mengizinkan akses.
      </Text>

      {/* Jalan keluar selalu terlihat: menunggu dua kegagalan dulu (perilaku
          lama) membuat tautan ini muncul tepat saat pengguna sudah frustrasi,
          dan berpindah-pindah tempat di bawah tombol. */}
      <View className="items-center">
        <TextLink variant="caption" onPress={forgotPassword} disabled={submitting}>
          Lupa kata sandi?
        </TextLink>
      </View>
    </VStack>
  )
}
