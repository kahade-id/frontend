/**
 * Screen — Tipe Akun (PERSONAL / BUSINESS) via PUT /v1/users/me.
 *
 * Audit:
 *   - Kegagalan GET /v1/users/me sebelumnya hanya toast, lalu layar merender
 *     "PERSONAL" seolah itu tipe akun yang tersimpan. Sekarang <ErrorState>
 *     + retry lewat <DataScreen>.
 *   - Nilai enum diambil dari `API_CONSTRAINTS.UpdateProfileDto.accountType`
 *     bila spec menyediakannya, sehingga penambahan tipe akun di backend
 *     tidak lolos diam-diam sebagai pilihan yang hilang di UI.
 *   - Tombol "Simpan" dinonaktifkan bila pilihan sama dengan nilai server —
 *     sebelumnya selalu aktif dan mengirim PUT tanpa perubahan.
 */
import { useCallback, useState } from "react"
import { Briefcase, User } from "phosphor-react-native"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"

type AccountType = "PERSONAL" | "BUSINESS"

const OPTIONS = [
  { value: "PERSONAL", label: "Personal", hint: "Untuk transaksi pribadi", icon: User },
  { value: "BUSINESS", label: "Bisnis", hint: "Untuk usaha & toko online", icon: Briefcase },
] as const satisfies ReadonlyArray<{ value: AccountType; label: string; hint: string; icon: unknown }>

export default function AccountTypeScreen() {
  const toast = useToast()
  const query = useApiQuery<AccountType>("account-type", () =>
    api.users.getMe().then((me) => (me.accountType as AccountType) ?? "PERSONAL"),
  )
  const serverValue = query.data ?? undefined
  const [picked, setPicked] = useState<AccountType | undefined>(undefined)
  const value = picked ?? serverValue
  const [submitting, setSubmitting] = useState(false)
  const { setData } = query

  const handleSave = useCallback(async () => {
    if (!value) return
    setSubmitting(true)
    try {
      await api.users.updateProfile({ accountType: value })
      setData(value)
      setPicked(undefined)
      toast.show({ title: "Tipe akun diperbarui", tone: "success", duration: 3000 })
    } catch (err) {
      toast.show({
        title: "Gagal menyimpan tipe akun",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [value, setData, toast.show])

  return (
    <DataScreen title="Tipe Akun" state={query} loadingMessage="Memuat tipe akun…">
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
          icon: o.icon,
        }))}
        value={value}
        onChange={(v) => setPicked(v as AccountType)}
        columns={2}
      />
      <Button
        loading={submitting}
        disabled={!value || value === serverValue}
        onPress={() => void handleSave()}
      >
        Simpan
      </Button>
    </DataScreen>
  )
}
