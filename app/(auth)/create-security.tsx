/**
 * Kahade — Buat Keamanan (screen #4 alur auth): password + PIN wallet.
 *
 * Struktur dua langkah dalam satu screen:
 *   Step 1 — Kata sandi:
 *     <Header title="Buat Keamanan" progress=3/4>
 *     H1 "Buat kata sandi" + persyaratan
 *     <PasswordField showStrength criteria 12+ char>
 *     <PasswordField confirmOf={password}>
 *     ── footer: [Lanjut] (disabled sampai valid + cocok)
 *
 *   Step 2 — PIN wallet:
 *     <Header title="Buat Keamanan" progress=3/4> back → step 1
 *     H1 "Buat PIN wallet" + penjelasan
 *     <PinInput mode="setup">  ← otomatis: buat → konfirmasi → match
 *     onComplete → simpan semua ke registration state → screen #5
 *
 * Kontrak API (field untuk `PhoneRegisterDto`):
 *   password   : minLength 12, maxLength 72, uppercase + lowercase + digit + symbol
 *   pin        : minLength 6, maxLength 6 (6 digit)
 *   Keduanya dikumpulkan di screen ini dan disimpan di `lib/registration.ts`
 *   untuk dipakai di screen #5 (Data Diri) yang submit ke `phone-register`.
 *
 * Keputusan non-obvious:
 *   - Dua langkah dalam SATU screen (bukan dua screen terpisah) karena password
 *     dan PIN adalah satu konsep "keamanan akun". Memisah jadi dua screen
 *     menambah friction tanpa manfaat. Step transisi instan (conditional render).
 *   - Submit MANUAL di step 1 (tombol "Lanjut"), bukan auto-advance — user
 *     perlu konfirmasi mental bahwa sandi mereka sudah benar sebelum lanjut.
 *   - Step 2 PIN auto-advance via `onComplete` — <PinInput mode="setup">
 *     sudah menangani create + confirm + match. Setelah cocok, langsung
 *     navigate. Tidak perlu tombol "Selesai" tambahan.
 *   - Criteria password OVERRIDE dari default PasswordStrength (8→12 char):
 *     backend PhoneRegisterDto mensyaratkan min 12 char, bukan 8. Criteria
 *     disesuaikan supaya checklist dan strength meter sinkron dengan validasi
 *     server. `showCriteria: true` menampilkan daftar persyaratan eksplisit.
 *   - Header back button custom: step 2 → step 1 (bukan ke OTP screen).
 *     Step 1 back → OTP screen (router.back()).
 *   - Guard: kalau `getRegistrationState()` null (langsung ke URL tanpa
 *     melewati OTP), redirect ke Register. tempToken dari verify-otp adalah
 *     prasyarat mutlak.
 *   - Password TIDAK di-hash di klien — dikirim plaintext ke phone-register
 *     (backend hash di server). Disimpan di module-level memory hanya selama
 *     alur registrasi berjalan (beberapa menit).
 */
import { Redirect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PasswordField } from "@/components/ui/password-field"
import { FooterBar } from "@/components/ui/footer-bar"
import { PinInput } from "@/components/ui/pin-input"
import { Button } from "@/components/ui/button"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { PASSWORD_MIN, PASSWORD_MAX, SECURITY_CRITERIA, isPasswordValid } from "@/lib/auth-constants"
import { getRegistrationState, setRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

/** Progress: registrasi via HP = 4 langkah, ini langkah ke-3 */
const STEP_PROGRESS = 3 / 4

export default function CreateSecurityScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // Dibaca di render (module memory, sinkron). Guard-nya ada SETELAH semua
  // hook di bawah — early-return di sini akan mengubah jumlah hook antar
  // render (Rules of Hooks) begitu state hilang, mis. setelah clear.
  const regState = getRegistrationState()

  const [step, setStep] = useState<1 | 2>(1)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const passwordValid = isPasswordValid(password)
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword
  const canProceed = passwordValid && passwordsMatch

  const handleProceedToPin = useCallback(() => {
    if (!canProceed) return
    setStep(2)
  }, [canProceed])

  const handlePinComplete = useCallback(
    (pinCode: string) => {
      if (!regState) return
      // Simpan password + PIN ke registration state untuk screen #5
      setRegistrationState({
        ...regState,
        password,
        pin: pinCode,
      })
      // Langsung ke screen Data Diri
      router.replace(ROUTES.profileData)
    },
    [regState, password, router],
  )

  const handleBack = useCallback(() => {
    if (step === 2) {
      // Kembali ke step password (data password tetap ada di state)
      setStep(1)
      return
    }
    // Kembali ke OTP screen; bila tidak ada riwayat (deep link), ke Register.
    if (router.canGoBack()) router.back()
    else router.replace(ROUTES.register)
  }, [step, router])

  // Guard: butuh registration state (tempToken) dari screen OTP
  if (!regState) {
    return <Redirect href={ROUTES.register} />
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <Header
        title="Buat Keamanan"
        progress={STEP_PROGRESS}
        safeArea={false}
        onBack={handleBack}
      />

      {step === 1 ? (
        /* ── Step 1: Kata sandi ────────────────────────────────────── */
        <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
          <ScrollView
            className="flex-1"
            contentContainerClassName="grow px-6 pb-8 pt-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <VStack gap={8}>
              <VStack gap={2}>
                <Heading level={1} className="text-balance">
                  Buat kata sandi
                </Heading>
                <Text numberOfLines={1} variant="body" tone="secondary" className="text-pretty">
                  Kata sandi melindungi akun Anda. Gunakan minimal{" "}
                  {PASSWORD_MIN} karakter dengan kombinasi huruf besar, huruf
                  kecil, angka, dan simbol.
                </Text>
              </VStack>

              <VStack gap={4}>
                <PasswordField
                  value={password}
                  onChangeText={setPassword}
                  showStrength
                  strengthProps={{
                    criteria: SECURITY_CRITERIA,
                    showCriteria: true,
                  }}
                  autoFocus
                  returnKeyType="next"
                  maxLength={PASSWORD_MAX}
                />

                <PasswordField
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  confirmOf={password}
                  returnKeyType="done"
                  maxLength={PASSWORD_MAX}
                />
              </VStack>
            </VStack>
          </ScrollView>

          {/* Footer: tombol Lanjut */}
          <FooterBar>
            <Button accessibilityHint="Ketuk untuk berinteraksi" onPress={handleProceedToPin} disabled={!canProceed}>
              Lanjut
            </Button>
          </FooterBar>
        </KeyboardAvoiding>
      ) : (
        /* ── Step 2: PIN wallet ────────────────────────────────────── */
        <View accessible={false}
          className="flex-1 px-6"
          style={{ paddingTop: tokens.space[8] }}
        >
          <VStack gap={8} className="items-center">
            <VStack gap={2} className="items-center px-2">
              <Heading level={1} className="text-center text-balance">
                Buat PIN wallet
              </Heading>
              <Text
                variant="body"
                tone="secondary"
                className="text-center text-pretty"
              >
                PIN 6 digit untuk mengonfirmasi transaksi. Jangan gunakan
                tanggal lahir atau angka yang mudah ditebak.
              </Text>
            </VStack>

            <PinInput
              mode="setup"
              length={6}
              onComplete={handlePinComplete}
              helperText="Gunakan angka yang mudah Anda ingat"
            />
          </VStack>
        </View>
      )}
    </Screen>
  )
}