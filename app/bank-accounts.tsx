import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Rekening Bank (CRUD + set utama).
 *
 * GET /v1/bank-accounts → list; POST → tambah; DELETE → hapus;
 * POST /{id}/set-primary → utama. Form memakai BankSelect dari
 * GET /v1/public/banks (logo resmi berwarna).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Plus, Trash } from "phosphor-react-native"

import { api, type AddBankAccountDto, userMessage } from "@/lib/api"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { tokens } from "@/lib/tokens"

import { BankAccountListItem } from "@/components/ui/bank-account-list-item"
import { BankSelect, type BankOption } from "@/components/ui/bank-select"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

export default function BankAccountsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [banks, setBanks] = useState<BankOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [adding, setAdding] = useState(false)
  const [bankCode, setBankCode] = useState<string | undefined>(undefined)
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [accountList, bankList] = await Promise.all([
        api.bankAccounts.listBankAccounts(),
        api.public.getBanks(),
      ])
      setAccounts(accountList ?? [])
      setBanks(
        (bankList ?? []).map((b) => ({
          code: b.code,
          name: b.name,
          logo: b.logoUrl ?? undefined,
          kind: "bank" as const,
        })),
      )
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  const handleAdd = useCallback(async () => {
    if (!bankCode || !bankName.trim() || !accountName.trim()) return
    setSubmitting(true)
    try {
      const dto: AddBankAccountDto = {
        bankCode: bankCode as AddBankAccountDto["bankCode"],
        bankName: bankName.trim() || (banks.find((b) => b.code === bankCode)?.name ?? bankCode),
        accountNumber: accountNumber.replace(/\D/g, ""),
        accountName: accountName.trim(),
      }
      await api.bankAccounts.addBankAccount(dto)
      toast.show({ title: "Rekening berhasil ditambahkan", tone: "success", duration: 3000 })
      setAdding(false)
      setBankName("")
      setAccountNumber("")
      setAccountName("")
      setBankCode(undefined)
      await fetchData()
    } catch {
      toast.show({
        title: "Gagal menambahkan rekening",
        description: "Periksa kembali data Anda.",
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [bankCode, bankName, accountNumber, accountName, banks, toast.show, fetchData])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.bankAccounts.deleteBankAccount(deleteTarget.id)
      toast.show({ title: "Rekening dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      await fetchData()
    } catch (err: unknown) {
      toast.show({
        title: "Gagal menghapus rekening",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast.show, fetchData])

  const handleSetPrimary = useCallback(
    async (acc: BankAccount) => {
      try {
        await api.bankAccounts.setPrimaryBankAccount(acc.id)
        toast.show({ title: "Rekening utama diperbarui", tone: "success", duration: 3000 })
        await fetchData()
      } catch (err: unknown) {
        toast.show({
          title: "Gagal memperbarui rekening utama",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [toast.show, fetchData],
  )

  const selectedBank = useMemo(() => banks.find((b) => b.code === bankCode), [banks, bankCode])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Rekening Bank" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <SectionHeader title="Rekening terdaftar" />
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchData()} />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Trash}
            title="Belum ada rekening"
            description="Tambahkan rekening bank untuk menarik dana."
          />
        ) : (
          <View className="gap-2">
            {accounts.map((acc, i) => (
              <BankAccountListItem
                key={acc.id}
                bankName={acc.bankName ?? acc.bankCode}
                bankCode={acc.bankCode}
                accountNumber={acc.accountNumber}
                accountHolder={acc.accountName}
                logo={selectedBank?.logo ?? undefined}
                primary={acc.isPrimary}
                verified={acc.isVerified}
                divider={i < accounts.length - 1}
              />
            ))}
            <View className="gap-2 pt-2">
              {accounts
                .filter((acc) => !acc.isPrimary)
                .map((acc) => (
                  <View key={`actions-${acc.id}`} className="flex-row gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      onPress={() => void handleSetPrimary(acc)}
                    >
                      Jadikan utama
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      leftIcon={Trash}
                      onPress={() => setDeleteTarget(acc)}
                    >
                      Hapus
                    </Button>
                  </View>
                ))}
            </View>
          </View>
        )}

        <SectionHeader title="Tambah rekening" />
        {!adding ? (
          <Button variant="secondary" leftIcon={Plus} onPress={() => setAdding(true)}>
            Tambah Rekening
          </Button>
        ) : (
          <FormSection title="Data rekening baru">
            <BankSelect
              banks={banks}
              value={bankCode}
              onChange={(code) => {
                setBankCode(code)
                setBankName((prev) => prev || (banks.find((b) => b.code === code)?.name ?? ""))
              }}
              label="Bank"
            />
            <Field label="Nomor rekening" required>
              <Input
                value={accountNumber}
                onChangeText={(t) => setAccountNumber(t.replace(/[^\d]/g, ""))}
                keyboardType="number-pad"
                placeholder="1234567890"
                maxLength={20}
              />
            </Field>
            <Field label="Nama pemilik rekening" required>
              <Input
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Sesuai rekening"
                maxLength={100}
              />
            </Field>
            <Button
              loading={submitting}
              onPress={() => void handleAdd()}
              disabled={!bankCode || !accountName.trim()}
            >
              Simpan Rekening
            </Button>
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => setAdding(false)}
              disabled={submitting}
            >
              Batal
            </Button>
          </FormSection>
        )}
      </PullToRefresh>

      <Dialog
        title="Hapus rekening?"
        description={`${deleteTarget?.bankName ?? ""} ${deleteTarget?.accountNumber ?? ""} akan dihapus dari daftar.`}
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </Screen>
  )
}
