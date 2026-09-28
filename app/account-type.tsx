/**
 * Screen — Tipe Akun (PERSONAL / BUSINESS) via PUT /v1/users/me.
 *
 * Audit:
 *   - Kegagalan GET /v1/users/me sebelumnya hanya toast, lalu layar merender
 *     "PERSONAL" seolah itu tipe akun yang tersimpan. Sekarang <ErrorState>
 *     + retry lewat <DataScreen>.
 *   - Nilai enum diturunkan dari `UpdateProfileDto["accountType"]` (generated
 *     dari spec), dan `OPTION_DETAILS` bertipe `Record<AccountType, …>` yang
 *     exhaustive — sehingga penambahan tipe akun di backend membuat typecheck
 *     gagal, bukan lolos diam-diam sebagai pilihan yang hilang di UI.
 *   - Tombol "Simpan" dinonaktifkan bila pilihan sama dengan nilai server —
 *     sebelumnya selalu aktif dan mengirim PUT tanpa perubahan.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { Briefcase, User } from "phosphor-react-native"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import type { UpdateProfileDto } from "@/lib/api/types"
import type { UserProfile } from "@/lib/api/users"
import { queryKeys } from "@/lib/query-keys"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import type { IconComponent } from "@/components/ui/icon"
import { Dialog } from "@/components/ui/modal"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { useToast } from "@/components/ui/toast"

/**
 * Diturunkan dari spec (`UpdateProfileDto.accountType` di `lib/api/types.ts`),
 * bukan ditulis manual — jadi enum yang bertambah di backend ikut berubah di sini.
 */
type AccountType = NonNullable<UpdateProfileDto["accountType"]>

/**
 * `Record<AccountType, …>` bersifat EXHAUSTIVE: begitu backend menambah satu
 * nilai enum, typecheck gagal di objek ini sampai label/hint/ikonnya dilengkapi.
 *
 * Sebelumnya `OPTIONS` adalah array `satisfies ReadonlyArray<{ value: AccountType … }>`,
 * yang hanya memeriksa arah sebaliknya (tiap opsi punya value sah) — sehingga
 * nilai enum baru lolos diam-diam sebagai pilihan yang hilang di UI. Komentar
 * audit di atas berkas ini mengklaim penjagaan itu sudah ada; sekarang memang ada.
 */
const OPTION_DETAILS: Record<AccountType, { label: string; hint: string; icon: IconComponent }> = {
  PERSONAL: { label: "Personal", hint: "Untuk transaksi pribadi", icon: User },
  BUSINESS: { label: "Bisnis", hint: "Untuk usaha & toko online", icon: Briefcase },
}

const OPTIONS = (Object.keys(OPTION_DETAILS) as AccountType[]).map((value) => ({
  value,
  ...OPTION_DETAILS[value],
}))

/**
 * FE-IMP-3 #97 — ringkasan konsekuensi ganti tipe akun, ditampilkan di dialog
 * konfirmasi SEBELUM menyimpan. Copy diturunkan dari deskripsi yang sudah ada
 * di layar ini ("Akun bisnis menampilkan profil usaha Anda di marketplace,
 * termasuk produk dan riwayat penjualan") — bukan aturan produk baru.
 */
const CONSEQUENCES: Record<AccountType, string[]> = {
  BUSINESS: [
    "Profil usaha Anda tampil di marketplace.",
    "Produk dan riwayat penjualan terlihat publik di profil.",
    "Dapat diubah kembali ke Personal kapan saja.",
  ],
  PERSONAL: [
    "Tampilan profil usaha disembunyikan dari publik.",
    "Produk dan riwayat penjualan tidak lagi tampil di profil publik.",
    "Dapat diubah kembali ke Bisnis kapan saja.",
  ],
}

export default function AccountTypeScreen() {
  const toast = useToast()
  /**
   * C-02 (audit): endpoint ini adalah `GET /v1/users/me` — kuncinya `queryKeys.me()`,
   * bukan kunci pribadi "account-type". Bentuk yang dibutuhkan layar ini
   * (satu nilai tipe akun) diproyeksikan lewat `select`, jadi respons baku yang
   * di-cache tetap SATU bentuk untuk semua layar.
   */
  const query = useApiQuery<UserProfile, AccountType>(
    queryKeys.me(),
    (signal) => api.users.getMe(signal),
    true,
    { select: (me) => (me.accountType as AccountType) ?? "PERSONAL" },
  )
  const serverValue = query.data ?? undefined
  const [picked, setPicked] = useState<AccountType | undefined>(undefined)
  const value = picked ?? serverValue
  const [submitting, setSubmitting] = useState(false)
  // FE-IMP-3 #97 — dialog konfirmasi berisi ringkasan konsekuensi.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { setData } = query

  const handleSave = useCallback(async () => {
    if (!value) return
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      await api.users.updateProfile({ accountType: value })
      // `setData` menerima nilai BAKU (profil), bukan hasil `select` — jadi
      // pembaruan optimistis ditulis sebagai patch field, bukan penggantian.
      setData((previous) => (previous ? { ...previous, accountType: value } : previous))
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
        onPress={() => setConfirmOpen(true)}
      >
        Simpan
      </Button>

      {/* FE-IMP-3 #97 — konfirmasi + ringkasan konsekuensi sebelum menyimpan. */}
      <Dialog
        visible={confirmOpen}
        title={value === "BUSINESS" ? "Ubah ke akun Bisnis?" : "Ubah ke akun Personal?"}
        description="Pastikan Anda memahami konsekuensinya sebelum menyimpan:"
        confirmLabel="Ya, ubah"
        cancelLabel="Batal"
        loading={submitting}
        onConfirm={() => void handleSave()}
        onCancel={() => setConfirmOpen(false)}
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View className="gap-1.5 pt-1">
          {(value ? CONSEQUENCES[value] : []).map((line) => (
            <View key={line} className="flex-row gap-2">
              <Text variant="body" tone="secondary">•</Text>
              <Text variant="body" tone="secondary" className="flex-1">
                {line}
              </Text>
            </View>
          ))}
        </View>
      </Dialog>
    </DataScreen>
  )
}