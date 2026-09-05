/**
 * Screen — Hapus Akun (POST /v1/users/me/delete-request).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { DeleteAccountForm } from "@/components/ui/delete-account-form"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (payload: { reason: string }) => {
      setSubmitting(true)
      try {
        await api.users.requestAccountDeletion({ password: "", reason: payload.reason })
        toast.show({
          title: "Permintaan penghapusan terkirim",
          description: "Akun Anda akan dihapus setelah masa tenggang.",
          tone: "success",
          duration: 5000,
        })
      } catch {
        toast.show({ title: "Gagal mengirim permintaan", tone: "danger" })
      } finally {
        setSubmitting(false)
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Hapus Akun" />
      <View className="gap-4 px-6" style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}>
        <DeleteAccountForm
          gracePeriodDays={30}
          confirmPhrase="HAPUS AKUN"
          onSubmit={(p) => void handleSubmit(p)}
          submitting={submitting}
        />
      </View>
    </Screen>
  )
}
