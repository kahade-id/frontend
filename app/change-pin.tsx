/**
 * Screen — Ubah PIN (POST /v1/wallet/set-pin).
 *
 * `SetPinDto` = { pin, currentPin?, password }. `currentPin` wajib saat PIN
 * sudah pernah dibuat — PIN selalu dibuat di onboarding (Buat Keamanan),
 * jadi layar ini SELALU meminta PIN lama.
 *
 * Alur: password akun → PIN lama (diverifikasi lewat POST /v1/wallet/verify-pin
 * supaya kesalahan ketahuan sebelum memilih PIN baru) → PIN baru (mode
 * "setup": masukkan + ulangi) → simpan → kembali ke layar sebelumnya.
 *
 * Keputusan non-obvious:
 *   - Validasi panjang password memakai `PASSWORD_MIN` dari lib/auth-constants
 *     (12), bukan angka literal — sama dengan aturan registrasi.
 *   - Bila `verify-pin` gagal karena jaringan (bukan PIN salah), pengguna
 *     tetap boleh lanjut: backend memvalidasi ulang `currentPin` di set-pin.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MIN } from "@/lib/auth-constants"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { PinInput } from "@/components/ui/pin-input"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

type Step = "password" | "current" | "new"

export default function ChangePinScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [currentPin, setCurrentPin] = useState("")
  const [currentError, setCurrentError] = useState<string | undefined>()
  const [newError, setNewError] = useState<string | undefined>()
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const passwordOk = password.length >= PASSWORD_MIN

  const handleCurrentPin = useCallback(async (pin: string) => {
    setVerifying(true)
    setCurrentError(undefined)
    try {
      const res = await api.wallet.verifyWalletPin({ pin })
      if (res && res.valid === false) {
        setCurrentError("PIN lama salah. Coba lagi.")
        return
      }
      setCurrentPin(pin)
      setStep("new")
    } catch (err) {
      // Error transient (jaringan/timeout/5xx) → lanjut, backend memvalidasi
      // ulang saat set-pin. Selain itu anggap PIN ditolak.
      if (isApiError(err) && err.code === "RATE_LIMITED") {
        setCurrentError("Terlalu banyak percobaan PIN. Coba lagi dalam 15 menit.")
        return
      }
      if (!isApiError(err) || !err.isTransient) {
        setCurrentError("PIN lama salah. Coba lagi.")
        return
      }
      setCurrentPin(pin)
      setStep("new")
    } finally {
      setVerifying(false)
    }
  }, [])

  const handleNewPin = useCallback(
    async (pin: string) => {
      if (pin === currentPin) {
        setNewError("PIN baru harus berbeda dari PIN lama.")
        return
      }
      setSubmitting(true)
      setNewError(undefined)
      try {
        await api.wallet.setWalletPin({ pin, currentPin, password })
        toast.show({ title: "PIN berhasil diubah", tone: "success" })
        goBackOrNavigate(ROUTES.settings)
      } catch (err: unknown) {
        // §14: percobaan PIN dibatasi. Bila backend mengunci akun, pesan itulah
        // yang harus dibaca pengguna — bukan saran "periksa password" yang
        // membuatnya mencoba lagi dan memperpanjang penguncian.
        const msg = userMessage(err)
        toast.show({ title: "Gagal mengubah PIN", description: msg, tone: "danger" })
        // A-18 (audit): error transient (jaringan/timeout/5xx) TIDAK lagi
        // melempar pengguna ke langkah password dan membuang PIN baru yang
        // sudah diketik dua kali — tetap di langkah "new". Hanya penolakan
        // autentikasi (password/PIN salah menurut server) yang kembali.
        const authRejected =
          isApiError(err) && (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN")
        if (authRejected) setStep("password")
        else setNewError(msg)
      } finally {
        setSubmitting(false)
      }
    },
    [currentPin, password, toast.show],
  )

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        step === "password" ? (
          <View>
            <Button fullWidth disabled={!passwordOk} onPress={() => setStep("current")}>
              Lanjut
            </Button>
          </View>
        ) : undefined
      }
    >
      <Header title="Ubah PIN" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5"
        style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}
      >
        {step === "password" ? (
          <>
            <SectionHeader title="Verifikasi kata sandi" />
            <Text variant="body" tone="secondary">
              Masukkan kata sandi akun untuk mengizinkan perubahan PIN.
            </Text>
            <PasswordField
              label="Kata sandi akun"
              value={password}
              onChangeText={setPassword}
              required
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => passwordOk && setStep("current")}
            />
          </>
        ) : step === "current" ? (
          <>
            <SectionHeader title="PIN lama" />
            <Text variant="body" tone="secondary">
              Masukkan PIN dompet yang sedang aktif.
            </Text>
            <PinInput
              mode="enter"
              onComplete={(p) => void handleCurrentPin(p)}
              disabled={verifying}
              errorText={currentError}
            />
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => setStep("password")}
              disabled={verifying}
            >
              Kembali
            </Button>
          </>
        ) : (
          <>
            <SectionHeader title="PIN baru" />
            <Text variant="body" tone="secondary">
              Pilih PIN 6 digit baru. Jangan gunakan tanggal lahir atau angka berurutan.
            </Text>
            <PinInput
              mode="setup"
              onComplete={(p) => void handleNewPin(p)}
              disabled={submitting}
              errorText={newError}
            />
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => setStep("current")}
              disabled={submitting}
            >
              Kembali
            </Button>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}