/**
 * Screen — Ubah Password (POST /v1/auth/change-password).
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets()
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
      toast.show({ title: "Password berhasil diubah", tone: "success", duration: 3000 })
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch {
      toast.show({
        title: "Gagal mengubah password",
        description: "Periksa password saat ini.",
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
            Simpan Password
          </Button>
        </View>
      }
    >
      <Header title="Ubah Password" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-6 py-4">
        <SectionHeader title="Password baru" />
        <PasswordField
          label="Password saat ini"
          value={current}
          onChangeText={setCurrent}
          required
        />
        <PasswordField
          label="Password baru"
          value={next}
          onChangeText={setNext}
          required
          showStrength
        />
        <PasswordField
          label="Ulangi password baru"
          value={confirm}
          onChangeText={setConfirm}
          confirmOf={next}
          required
        />
      </ScrollView>
    </Screen>
  )
}
