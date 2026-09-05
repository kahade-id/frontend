/**
 * Screen — Ubah PIN (POST /v1/wallet/set-pin, mode setup PinInput).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { PinInput } from "@/components/ui/pin-input"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function ChangePinScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [mode, setMode] = useState<"form" | "pin">("form")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [pinSaved, setPinSaved] = useState(false)

  const handleComplete = useCallback(
    async (pin: string) => {
      setSubmitting(true)
      try {
        // Set PIN memakai currentPin+password bila sudah pernah dibuat; di sini
        // kita kirim currentPin = pin lama bila ada (2FA verified di layar lain
        // tidak tersedia), jadi tetap gunakan PIN baru tanpa currentPin.
        await api.wallet.setWalletPin({ pin, password })
        setPinSaved(true)
        toast.show({ title: "PIN berhasil diubah", tone: "success", duration: 3000 })
      } catch {
        toast.show({ title: "Gagal mengubah PIN", description: "Periksa password akun Anda.", tone: "danger" })
        setMode("form")
      } finally {
        setSubmitting(false)
      }
    },
    [password, toast.show],
  )

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        mode === "form" ? (
          <View className="px-6 pb-4">
            <Button fullWidth disabled={password.length < 8} onPress={() => setMode("pin")}>
              Lanjut
            </Button>
          </View>
        ) : undefined
      }
    >
      <Header title="Ubah PIN" />
      <View className="gap-4 px-6" style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}>
        {pinSaved ? (
          <>
            <SectionHeader title="PIN diperbarui" />
            <Text variant="body" tone="secondary">
              PIN baru Anda aktif untuk transaksi dompet.
            </Text>
          </>
        ) : mode === "form" ? (
          <>
            <SectionHeader title="Verifikasi password" />
            <Text variant="body" tone="secondary">
              Masukkan password akun untuk mengizinkan perubahan PIN.
            </Text>
            <PasswordField label="Password akun" value={password} onChangeText={setPassword} required />
          </>
        ) : (
          <>
            <SectionHeader title="PIN baru" />
            <Text variant="body" tone="secondary">
              Pilih PIN 6 digit baru. Jangan gunakan tanggal lahir atau angka berurutan.
            </Text>
            <PinInput mode="setup" onComplete={(p) => void handleComplete(p)} disabled={submitting} />
            <Button variant="ghost" fullWidth={false} onPress={() => setMode("form")} disabled={submitting}>
              Batal
            </Button>
          </>
        )}
      </View>
    </Screen>
  )
}
