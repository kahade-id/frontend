/**
 * Screen — Ubah Password (POST /v1/auth/change-password).
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"

import { api, userMessage } from "@/lib/api"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

export default function ChangePasswordScreen() {
  const toast = useToast()

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!current || next.length < 12 || next !== confirm) return
    setSubmitting(true)
    try {
      await api.auth.changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      })
      toast.show({ title: "Kata sandi berhasil diubah", tone: "success", duration: 3000 })
      setCurrent("")
      setNext("")
      setConfirm("")
      goBackOrNavigate(ROUTES.settings)
    } catch (err: unknown) {
      // Alasan asli backend (password salah / rate limit / password pernah
      // dipakai) harus sampai ke pengguna — menebak "Periksa password saat ini"
      // menyesatkan saat yang terjadi sebenarnya adalah pembatasan percobaan.
      toast.show({
        title: "Gagal mengubah kata sandi",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [current, next, confirm, toast.show])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          <Button
            fullWidth
            loading={submitting}
            disabled={!current || next.length < 12 || next !== confirm}
            onPress={() => void handleSubmit()}
          >
            Simpan password
          </Button>
        </View>
      }
    >
      <Header title="Ubah Kata Sandi" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-5 py-4">
        <SectionHeader title="Kata sandi baru" />
        <PasswordField
          label="Kata sandi saat ini"
          value={current}
          onChangeText={setCurrent}
          required
        />
        <PasswordField
          label="Kata sandi baru"
          value={next}
          onChangeText={setNext}
          required
          showStrength
        />
        <PasswordField
          label="Ulangi kata sandi baru"
          value={confirm}
          onChangeText={setConfirm}
          confirmOf={next}
          required
        />
      </ScrollView>
    </Screen>
  )
}