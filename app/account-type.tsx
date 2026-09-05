/**
 * Screen — Tipe Akun (PERSONAL / BUSINESS) via PUT /v1/users/me.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Briefcase, User } from "phosphor-react-native"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"

type AccountType = "PERSONAL" | "BUSINESS"

const OPTIONS = [
  { value: "PERSONAL", label: "Personal", hint: "Untuk transaksi pribadi" },
  { value: "BUSINESS", label: "Bisnis", hint: "Untuk usaha & toko online" },
] as const

export default function AccountTypeScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [value, setValue] = useState<AccountType | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchType = useCallback(async () => {
    setLoading(true)
    try {
      const me = await api.users.getMe()
      setValue(me.accountType ?? "PERSONAL")
    } catch {
      toast.show({ title: "Gagal memuat tipe akun", tone: "danger" })
    } finally {
      setLoading(false)
    }
  }, [toast.show])

  useEffect(() => {
    void fetchType()
  }, [fetchType])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchType()
    setRefreshing(false)
  }, [fetchType])

  const handleSave = useCallback(async () => {
    if (!value) return
    setSubmitting(true)
    try {
      await api.users.updateProfile({ accountType: value })
      toast.show({ title: "Tipe akun diperbarui", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal menyimpan tipe akun", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [value, toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tipe Akun" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Pilih tipe akun" />
          <Text variant="body" tone="secondary">
            Akun bisnis menampilkan profil usaha Anda di marketplace, termasuk produk dan riwayat
            penjualan.
          </Text>
          <ToggleGroup
            options={OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              hint: o.hint,
              icon: o.value === "BUSINESS" ? Briefcase : User,
            }))}
            value={value}
            onChange={(v) => setValue(v as AccountType)}
            columns={2}
            disabled={loading}
          />
          <Button loading={submitting} disabled={!value} onPress={() => void handleSave()}>
            Simpan
          </Button>
        </View>
      </PullToRefresh>
    </Screen>
  )
}
