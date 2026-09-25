/**
 * Kahade — Buat Kata Sandi (screen #4/4 alur registrasi via HP).
 *
 * Struktur:
 *   <Header title="Buat Kata Sandi" progress=4/4>
 *   VStack gap={8}:
 *     VStack (H1 + penjelasan)
 *     Input "Nama lengkap"
 *     Input "Username" (opsional)
 *     PasswordField (kata sandi — TANPA strength meter: tidak ada syarat
 *       complexity, hanya minimal 8 karakter per keputusan produk)
 *     PasswordField (konfirmasi)
 *     Button "Buat akun"
 *     Alert error (jika ada)
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/phone-register  body { tempToken, fullName, username?,
 *     password, deviceId, location? }
 *   - tempToken hasil verify-otp (status new_user), disimpan di
 *     lib/registration.ts (memori modul, bukan route params / SecureStore).
 *   - username kosong → kirim `undefined` (backend memperlakukannya sebagai
 *     "tidak diisi").
 *   - Kata sandi: min 8, maks 72, TANPA syarat huruf besar/kecil, angka, simbol.
 *   - Token sesi disimpan otomatis oleh auth.ts → lanjut /setup-profile.
 *
 * Keputusan non-obvious:
 *   - Tidak ada lagi PIN 6 digit — kontrak baru hanya password.
 *   - Strength meter TIDAK dirender: kriteria complexity sudah dihapus dari
 *     keputusan produk; meter lama ("Lemah" untuk 8 huruf kecil) akan
 *     menyesatkan.
 *   - fullName disimpan kembali ke registration state setelah sukses supaya
 *     setup-profile bisa menyapa user tanpa meminta ulang (state hanya
 *     dihapus setelah setup-profile selesai / user keluar dari alur).
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MAX, isPasswordValid } from "@/lib/auth-constants"
import { getAuthLocation } from "@/lib/location"
import {
  getRegistrationState,
  setRegistrationState,
} from "@/lib/registration"
import { ROUTES } from "@/lib/routes"

/** Registrasi via HP: 4 langkah — ini langkah ke-4 (terakhir). */
const STEP_PROGRESS = 4 / 4

export default function RegisterSecurityScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // tempToken hasil verifikasi OTP (memori modul, bukan route params).
  const regRef = useState(getRegistrationState)[0]
  const tempToken = regRef?.tempToken
  const phoneNumber = regRef?.phoneNumber

  // Tanpa tempToken (deep-link/reload langsung ke rute ini) → tidak bisa
  // dipakai; kembali ke awal registrasi.
  useEffect(() => {
    if (!tempToken) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.register)
    }
  }, [tempToken, router])

  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullNameError, setFullNameError] = useState<string | undefined>()
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmError, setConfirmError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isFormValid =
    fullName.trim().length > 0 && password.length > 0 && confirmPassword.length > 0

  const handleSubmit = useCallback(async () => {
    if (submitting || !tempToken || !phoneNumber) return
    setFormError(null)

    if (fullName.trim().length === 0) {
      setFullNameError("Nama lengkap wajib diisi.")
      return
    }
    if (!isPasswordValid(password)) {
      setPasswordError("Kata sandi minimal 8 karakter.")
      return
    }
    if (confirmPassword !== password) {
      setConfirmError("Konfirmasi kata sandi tidak sama.")
      return
    }

    setSubmitting(true)
    try {
      await api.auth.phoneRegister({
        tempToken,
        fullName: fullName.trim(),
        // Username kosong → undefined (backend = "tidak diisi").
        username: username.trim().length > 0 ? username.trim() : undefined,
        password,
        location: (await getAuthLocation()) ?? undefined,
      })
      // Simpan fullName untuk sapaan di setup-profile; token sesi sudah
      // disimpan otomatis oleh auth.ts. Password TIDAK disimpan.
      setRegistrationState({ tempToken: "", phoneNumber, fullName: fullName.trim() })
      router.replace(ROUTES.setupProfile)
    } catch (err) {
      if (isApiError(err)) {
        const mentionsUsername = (err.validationMessages ?? [err.message]).find((m) =>
          /username|nama pengguna/i.test(m),
        )
        if ((err.code === "VALIDATION" || err.code === "BAD_REQUEST" || err.code === "CONFLICT") && mentionsUsername) {
          setFormError(mentionsUsername)
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, tempToken, phoneNumber, fullName, username, password, confirmPassword, router])

  if (!tempToken) return null

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Buat Kata Sandi" progress={STEP_PROGRESS} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn duration="fast">
            <VStack gap={8}>
              <VStack gap={2}>
                <Heading level={1} className="text-balance">
                  Lengkapi data diri Anda
                </Heading>
                <Text variant="body" tone="secondary" className="text-pretty">
                  Nomor HP Anda sudah terverifikasi. Terakhir, buat kata sandi
                  dan isi data diri untuk menyelesaikan akun.
                </Text>
              </VStack>

              <VStack gap={4}>
                <Input
                  label="Nama lengkap"
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t)
                    setFullNameError(undefined)
                    setFormError(null)
                  }}
                  errorText={fullNameError}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="name"
                  textContentType="name"
                  required
                  autoFocus
                  returnKeyType="next"
                  disabled={submitting}
                />

                <Input
                  label="Username"
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t)
                    setFormError(null)
                  }}
                  helperText="Opsional — bisa diisi nanti"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  disabled={submitting}
                />

                {/* Tanpa strength meter: tidak ada syarat complexity, hanya
                    panjang 8–72. */}
                <PasswordField
                  label="Kata sandi"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t)
                    setPasswordError(undefined)
                    setFormError(null)
                  }}
                  errorText={passwordError}
                  helperText="Minimal 8 karakter"
                  maxLength={PASSWORD_MAX}
                  required
                  returnKeyType="next"
                  disabled={submitting}
                />

                <PasswordField
                  label="Konfirmasi kata sandi"
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t)
                    setConfirmError(undefined)
                    setFormError(null)
                  }}
                  errorText={confirmError}
                  maxLength={PASSWORD_MAX}
                  required
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                  disabled={submitting}
                />
              </VStack>

              <Button
                onPress={() => void handleSubmit()}
                loading={submitting}
                disabled={!isFormValid}
              >
                Buat akun
              </Button>

              {formError ? (
                <Alert tone="danger" title="Gagal membuat akun" onDismiss={() => setFormError(null)}>
                  {formError}
                </Alert>
              ) : null}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Dengan membuat akun, Anda menyetujui Syarat & Ketentuan serta
            Kebijakan Privasi Kahade.
          </Text>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
