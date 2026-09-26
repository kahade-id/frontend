/**
 * Kahade — Admin login (§admin).
 *
 * Pintu masuk panel admin. Alur:
 * 1. Email + password → POST /v1/admin/auth/login
 * 2. Bila `requiresMfa` → tampilkan input TOTP → POST /v1/admin/auth/2fa/verify
 * 3. Token tersimpan (SecureStore, key terpisah dari sesi user) →
 *    router.replace("/admin/(panel)")
 *
 * Sesi admin TIDAK mengganggu sesi user: perangkat bisa dipakai sebagai user
 * biasa dan admin bergantian tanpa logout satu sama lain.
 */
import { useState } from "react"
import { View } from "react-native"
import { router, Stack } from "expo-router"

import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardBody } from "@/components/ui/card"
import { translate } from "@/lib/i18n/translate"
import { userMessage } from "@/lib/api"
import { adminLogin, adminVerify2fa } from "@/lib/api/admin/auth"

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [totp, setTotp] = useState("")
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setError(null)
    if (!email.trim() || !password) {
      setError(translate("Isi email dan kata sandi admin."))
      return
    }
    setLoading(true)
    try {
      const res = await adminLogin(email.trim(), password)
      if ("requiresMfa" in res && res.requiresMfa) {
        setTempToken(res.tempToken)
      } else {
        router.replace("/admin/(panel)")
      }
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2fa() {
    setError(null)
    if (!tempToken || totp.trim().length < 6) {
      setError(translate("Masukkan kode 6 digit dari aplikasi authenticator."))
      return
    }
    setLoading(true)
    try {
      await adminVerify2fa(tempToken, totp.trim())
      router.replace("/admin/(panel)")
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: translate("Login Admin"), headerShown: true }} />
      <Screen scroll keyboardAvoiding>
        <View className="gap-5 pt-8">
          <View className="gap-1">
            <Text variant="h1" weight={700}>
              {translate("Panel Admin")}
            </Text>
            <Text variant="body" tone="secondary">
              {translate("Kelola verifikasi, sengketa, dan operasional Kahade.")}
            </Text>
          </View>

          <Card>
            <CardBody className="gap-4">
              {tempToken ? (
                <>
                  <Text variant="body" tone="secondary">
                    {translate("Akun ini memakai verifikasi 2 langkah.")}
                  </Text>
                  <Input
                    label={translate("Kode authenticator")}
                    value={totp}
                    onChangeText={setTotp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    accessibilityLabel={translate("Kode authenticator")}
                    onSubmitEditing={handleVerify2fa}
                    returnKeyType="go"
                  />
                </>
              ) : (
                <>
                  <Input
                    label={translate("Email admin")}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={translate("Email admin")}
                    onSubmitEditing={handleLogin}
                    returnKeyType="next"
                  />
                  <Input
                    label={translate("Kata sandi")}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    accessibilityLabel={translate("Kata sandi")}
                    onSubmitEditing={handleLogin}
                    returnKeyType="go"
                  />
                </>
              )}

              {error ? (
                <Text variant="body" tone="danger" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}

              <Button
                loading={loading}
                onPress={tempToken ? handleVerify2fa : handleLogin}
                accessibilityLabel={tempToken ? translate("Verifikasi") : translate("Masuk")}
              >
                {tempToken ? translate("Verifikasi") : translate("Masuk")}
              </Button>
            </CardBody>
          </Card>

          <Text variant="caption" tone="secondary" className="text-center">
            {translate("Akses terbatas untuk tim operasional Kahade.")}
          </Text>
        </View>
      </Screen>
    </>
  )
}
