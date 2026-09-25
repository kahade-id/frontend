/**
 * Kahade — Buat Kata Sandi Baru (reset setelah OTP WhatsApp terverifikasi).
 *
 * Struktur:
 *   <Header title="Kata Sandi Baru" progress={3/3}>
 *   VStack gap={8}:
 *     VStack (H1 + penjelasan)
 *     PasswordField (kata sandi baru)
 *     PasswordField (konfirmasi)
 *     Button "Simpan kata sandi"
 *     Alert error (jika ada)
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/reset-password  body { tempToken, newPassword, location? }
 *   - OTP sudah diverifikasi di /verify-otp (status password_reset) — layar
 *     ini TIDAK lagi menerima kode OTP; yang disimpan hanya tempToken di
 *     lib/password-reset.ts (memori modul, bukan route params).
 *   - Kata sandi minimum 8 karakter TANPA syarat complexity (keputusan
 *     produk) — tidak ada hint complexity dan tidak ada strength meter.
 *   - Setelah sukses: state reset dibersihkan, user diarahkan ke /login
 *     (belum login — sesi baru dibuat saat login ulang).
 *
 * Keputusan non-obvious:
 *   - Tanpa tempToken di memori (deep-link/reload langsung ke rute ini),
 *     layar tidak bisa dipakai — kembali ke /forgot-password.
 *   - Konfirmasi harus persis sama; bandingkan saat submit (bukan on-change)
 *     agar error tidak berkedip saat mengetik.
 *   - Lokasi opsional dicatat; null = lanjut tanpa lokasi.
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
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { api, userMessage } from "@/lib/api"
import { isPasswordValid } from "@/lib/auth-constants"
import { getAuthLocation } from "@/lib/location"
import { clearPasswordResetState, getPasswordResetState } from "@/lib/password-reset"
import { ROUTES } from "@/lib/routes"

/** Lupa kata sandi = 3 langkah: nomor → trigger WA → OTP → kata sandi baru. */
const STEP_PROGRESS = 3 / 3

export default function ResetPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // tempToken hasil verifikasi OTP (memori modul, bukan route params).
  const resetRef = useState(getPasswordResetState)[0]
  const tempToken = resetRef?.tempToken

  // Tanpa tempToken (deep-link/reload langsung ke rute ini) → tidak bisa
  // dipakai; kembali ke awal alur.
  useEffect(() => {
    if (!tempToken) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.forgotPassword())
    }
  }, [tempToken, router])

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmError, setConfirmError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (submitting || !tempToken) return
    setFormError(null)

    if (!isPasswordValid(newPassword)) {
      setPasswordError("Kata sandi minimal 8 karakter.")
      return
    }
    if (confirmPassword !== newPassword) {
      setConfirmError("Konfirmasi kata sandi tidak sama.")
      return
    }

    setSubmitting(true)
    try {
      await api.auth.resetPassword({
        tempToken,
        newPassword,
        location: (await getAuthLocation()) ?? undefined,
      })
      clearPasswordResetState()
      // Kata sandi berubah → user login ulang (belum punya sesi).
      router.replace(ROUTES.login)
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, tempToken, newPassword, confirmPassword, router])

  if (!tempToken) return null

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Kata Sandi Baru" progress={STEP_PROGRESS} safeArea={false} />

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
                  Buat kata sandi baru
                </Heading>
                <Text variant="body" tone="secondary" className="text-pretty">
                  Pilih kata sandi baru untuk akun Anda. Minimal 8 karakter.
                </Text>
              </VStack>

              <VStack gap={4}>
                <PasswordField
                  label="Kata sandi baru"
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t)
                    setPasswordError(undefined)
                    setFormError(null)
                  }}
                  errorText={passwordError}
                  helperText="Minimal 8 karakter"
                  required
                  autoFocus
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
                  required
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                  disabled={submitting}
                />
              </VStack>

              <Button
                onPress={() => void handleSubmit()}
                loading={submitting}
                disabled={newPassword.length === 0 || confirmPassword.length === 0}
              >
                Simpan kata sandi
              </Button>

              {formError ? (
                <Alert tone="danger" title="Gagal menyimpan" onDismiss={() => setFormError(null)}>
                  {formError}
                </Alert>
              ) : null}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Setelah kata sandi tersimpan, Anda akan diarahkan untuk masuk
            kembali dengan kata sandi baru.
          </Text>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
