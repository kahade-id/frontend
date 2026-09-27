/**
 * Kahade — Konfirmasi Tautan Sosial (GAP-A G014).
 *
 * Muncul setelah login Google/Apple menemukan email yang sudah dipakai akun
 * Kahade lain. KEAMANAN: penautan HANYA terjadi setelah user membuktikan
 * kepemilikan akun Kahade lama — kata sandi (+ kode 2FA bila aktif).
 * Penguasaan akun Google/Apple saja TIDAK cukup (anti account-takeover).
 *
 * Params: linkToken (sekali-pakai), maskedEmail, provider.
 */

import { useEffect, useRef, useState } from "react"
import { ScrollView, TextInput } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, userMessage } from "@/lib/api"
import { MFA_CODE_MAX_LENGTH, normalizeMfaCode } from "@/lib/auth-ui"
import { setPendingNext } from "@/lib/login-redirect"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"

export default function SocialLinkConfirmScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { linkToken, maskedEmail, provider } = useLocalSearchParams<{
    linkToken?: string
    maskedEmail?: string
    provider?: string
  }>()

  const providerLabel = provider === "APPLE" ? "Apple" : "Google"
  const [password, setPassword] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  const [showMfa, setShowMfa] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const mfaRef = useRef<TextInput>(null)

  // Kolom MFA muncul kondisional (setelah backend meminta 2FA) — fokuskan
  // agar pengguna tidak perlu mengetuk manual.
  useEffect(() => {
    if (showMfa) mfaRef.current?.focus()
  }, [showMfa])

  if (!linkToken) {
    return (
      <Screen edges={["top"]}>
        <Header title="Tautkan Akun" />
        <VStack gap={4} className="px-5 pt-6">
          <Alert tone="danger">
            Tautan konfirmasi tidak valid atau kedaluwarsa. Ulangi login sosial Anda.
          </Alert>
          <Button variant="secondary" onPress={() => router.replace(ROUTES.login)}>
            Kembali ke Masuk
          </Button>
        </VStack>
      </Screen>
    )
  }

  const handleConfirm = async () => {
    if (submitting || !password) return
    setSubmitting(true)
    setErrorText(null)
    try {
      const result = await api.social.confirmSocialLink({
        linkToken,
        password,
        mfaCode: showMfa && mfaCode.trim() ? mfaCode.trim() : undefined,
      })
      if (result.linked) {
        setPendingNext(undefined)
        router.replace(ROUTES.welcome())
      } else {
        setErrorText("Penautan belum berhasil. Coba lagi.")
      }
    } catch (err) {
      if (isApiError(err)) {
        const code = err.backendCode ?? ""
        // 2FA aktif tapi kode belum diminta/diberikan → tampilkan kolom kode.
        if (code === "TWO_FA_REQUIRED" || code === "INVALID_MFA_CODE" || /2fa|mfa|totp/i.test(err.message)) {
          setShowMfa(true)
          setErrorText("Akun ini memakai autentikasi 2 langkah. Masukkan kode authenticator Anda.")
          return
        }
        if (err.code === "UNAUTHORIZED") {
          setErrorText("Kata sandi salah. Masukkan kata sandi akun Kahade Anda.")
          return
        }
        if (code === "INVALID_TOKEN" || code === "LINK_TOKEN_USED") {
          setErrorText("Tautan konfirmasi kedaluwarsa atau sudah dipakai. Ulangi login sosial Anda.")
          return
        }
        if (code === "SOCIAL_ACCOUNT_TAKEN") {
          setErrorText(`Akun ${providerLabel} ini sudah tertaut ke akun Kahade lain.`)
          return
        }
      }
      setErrorText(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Tautkan Akun" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <VStack gap={2}>
          <Heading level={1}>Email sudah terdaftar</Heading>
          <Text variant="body" tone="secondary" className="text-pretty">
            {maskedEmail ? `Email ${maskedEmail} ` : "Email "}
            sudah dipakai akun Kahade. Untuk menautkan akun {providerLabel} ini, buktikan bahwa
            akun Kahade tersebut milik Anda dengan memasukkan kata sandinya.
          </Text>
        </VStack>

        {errorText ? (
          <Alert tone="danger" title="Gagal menautkan" onDismiss={() => setErrorText(null)}>
            {errorText}
          </Alert>
        ) : null}

        <VStack gap={4}>
          <PasswordField
            label="Kata sandi akun Kahade"
            value={password}
            onChangeText={(t) => {
              setPassword(t)
              setErrorText(null)
            }}
            required
            autoFocus
            returnKeyType={showMfa ? "next" : "done"}
            onSubmitEditing={() => void handleConfirm()}
            disabled={submitting}
          />
          {showMfa ? (
            <Input
              label="Kode authenticator (2FA)"
              ref={mfaRef}
              value={mfaCode}
              onChangeText={(t) => {
                // UI-A001: kode cadangan alfanumerik (10–16 karakter) harus
                // lolos utuh — hanya whitespace yang dibuang, bukan non-digit.
                setMfaCode(normalizeMfaCode(t))
                setErrorText(null)
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={MFA_CODE_MAX_LENGTH}
              required
              returnKeyType="done"
              onSubmitEditing={() => void handleConfirm()}
              disabled={submitting}
              helperText="6 digit dari aplikasi authenticator, atau kode cadangan."
            />
          ) : null}
          <Button onPress={() => void handleConfirm()} loading={submitting} disabled={!password}>
            Tautkan & Masuk
          </Button>
          <Button variant="ghost" onPress={() => router.replace(ROUTES.login)} disabled={submitting}>
            Batal
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  )
}
