/** Familiar sign-in flow, with a clearer hierarchy and persistent field labels. */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Alert } from "@/components/ui/alert"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { ROUTES } from "@/lib/routes"
import { setPendingTwoFactorLogin } from "@/lib/two-factor-login"

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const isFormValid = isValidEmail(email) && password.length > 0
  // Authentication, 2FA memory handling and error mapping are deliberately unchanged.
  const handleLogin = useCallback(async () => {
    if (submitting || !isFormValid) return
    setSubmitting(true)
    setFormError(null)
    try {
      const result = await api.auth.login({ email: email.trim(), password })
      if (result.requiresTwoFactor) {
        setPendingTwoFactorLogin({ tempToken: result.tempToken, email: email.trim() })
        router.push(ROUTES.verify2fa)
        return
      }
      router.replace(ROUTES.welcome())
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "UNAUTHORIZED") { setFormError("Email atau kata sandi salah. Periksa kembali dan coba lagi."); return }
        if (err.code === "RATE_LIMITED") { setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi."); return }
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") { setFormError(err.message || "Data tidak valid. Periksa email dan kata sandi Anda."); return }
      }
      setFormError(userMessage(err))
    } finally { setSubmitting(false) }
  }, [submitting, isFormValid, email, password, router])
  const handleForgotPassword = useCallback(() => router.push(ROUTES.forgotPassword), [router])
  const handleRegister = useCallback(() => router.push(ROUTES.register), [router])
  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Masuk" safeArea={false} showBack={false} />
      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView className="flex-1" contentContainerClassName="grow px-6 pb-8 pt-12"
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <VStack gap={8}>
            <VStack gap={4}>
              <Text variant="label" tone="info">Kahade</Text>
              <Heading level={1}>Selamat datang kembali</Heading>
              <Text variant="body" tone="secondary">Masuk ke akun Kahade Anda untuk melanjutkan.</Text>
            </VStack>
            <VStack gap={6}>
              <EmailField label="Email" value={email} helperText="Contoh: nama@email.com"
                onChangeText={(text) => { setEmail(text); setFormError(null) }}
                required returnKeyType="next" disabled={submitting} />
              <PasswordField value={password} onChangeText={(text) => { setPassword(text); setFormError(null) }}
                required returnKeyType="done" onSubmitEditing={() => void handleLogin()} maxLength={PASSWORD_MAX} disabled={submitting} />
              <View className="items-end"><TextLink onPress={handleForgotPassword} disabled={submitting}>Lupa password?</TextLink></View>
            </VStack>
            {formError ? <Alert tone="danger" title="Gagal masuk" onDismiss={() => setFormError(null)}>{formError}</Alert> : null}
            <Button accessibilityHint="Masuk menggunakan email dan kata sandi" onPress={() => void handleLogin()} loading={submitting} disabled={!isFormValid}>Masuk</Button>
          </VStack>
        </ScrollView>
        <FooterBar><Text variant="body" tone="secondary" className="text-center">Belum punya akun?{" "}<TextLink inline onPress={handleRegister} disabled={submitting}>Daftar</TextLink></Text></FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
