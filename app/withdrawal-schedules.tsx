/**
 * Screen — Jadwal Penarikan Otomatis (GET/POST/PUT/DELETE /v1/withdrawals/schedules).
 * Memakai WithdrawalScheduleCard + ScheduleField (hari + nominal minimum).
 */

import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bank, Plus } from "phosphor-react-native"

import { api, type CreateScheduleDto, type UpdateScheduleDto, userMessage } from "@/lib/api"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { AMOUNT_LIMITS, AMOUNT_PRESETS } from "@/lib/financial"
import type { WithdrawalSchedule } from "@/lib/api/withdrawals"
import { formatRupiah, maskAccountNumber } from "@/lib/format"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { tokens } from "@/lib/tokens"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { ScheduleField, type ScheduleValue } from "@/components/ui/schedule-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Select, SelectOptionList } from "@/components/ui/select"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { WithdrawalScheduleCard } from "@/components/ui/withdrawal-schedule-card"
import { translate } from "@/lib/i18n/translate"

export default function WithdrawalSchedulesScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchAll()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti daftar jadwal dengan kerangka. Request juga tidak dibatalkan
   * saat layar ditutup. `useApiQuery` memisahkan `refreshing` dari `loading`
   * dan meneruskan AbortSignal ke adapter.
   */
  const query = useApiQuery<WithdrawalSchedule[]>(
    "withdrawal-schedules",
    async (signal) => (await api.withdrawals.listWithdrawalSchedules(signal)) ?? [],
  )
  const items = query.data ?? []
  const { loading, error, refreshing } = query

  // C-02 (audit): kunci disatukan dengan layar rekening/penarikan.
  const bankAccountsQuery = useApiQuery<BankAccount[]>(
    queryKeys.bankAccounts(),
    async (signal) => (await api.bankAccounts.listBankAccounts(signal)) ?? [],
  )
  const accounts = bankAccountsQuery.data ?? []

  const [editing, setEditing] = useState<WithdrawalSchedule | null>(null)
  const [creating, setCreating] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleValue>({ dayOfWeek: 1, minAmount: 0 })
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("")
  const [bankSheetOpen, setBankSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WithdrawalSchedule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const openCreate = useCallback(() => {
    setEditing(null)
    setCreating(true)
    setSchedule({ dayOfWeek: 1, minAmount: 0 })
    const defaultAcc = accounts.find((a) => a.isPrimary) ?? accounts[0]
    setSelectedBankAccountId(defaultAcc?.id ?? "")
  }, [accounts])

  const openEdit = useCallback((s: WithdrawalSchedule) => {
    setEditing(s)
    setCreating(false)
    setSchedule({ dayOfWeek: s.dayOfWeek, minAmount: s.minAmount ?? 0 })
    setSelectedBankAccountId(s.bankAccount.id)
  }, [])

  /**
   * Audit: form menerima nominal apa pun > 0 padahal WithdrawDto.amount punya
   * minimum kontrak. Jadwal di bawah minimum akan selalu ditolak server pada
   * eksekusi penarikan — gagalnya jauh dari tempat pengguna mengisinya.
   */
  const minAmountError =
    schedule.minAmount != null &&
    schedule.minAmount > 0 &&
    schedule.minAmount < AMOUNT_LIMITS.withdraw.minimum
      ? `Minimum ${formatRupiah(AMOUNT_LIMITS.withdraw.minimum)}.`
      : undefined

  const handleSubmit = useCallback(async () => {
    const targetBankAccountId = editing ? editing.bankAccount.id : selectedBankAccountId
    if (!targetBankAccountId && !editing) {
      toast.show({
        title: "Pilih rekening bank tujuan",
        description: "Tambahkan atau pilih rekening bank untuk penarikan.",
        tone: "danger",
      })
      return
    }
    setSubmitting(true)
    try {
      if (editing) {
        const dto: UpdateScheduleDto = {
          dayOfWeek: schedule.dayOfWeek ?? 1,
          minAmount: (schedule.minAmount ?? 0) > 0 ? (schedule.minAmount ?? undefined) : undefined,
          bankAccountId: editing.bankAccount.id,
          isActive: editing.isActive,
        }
        await api.withdrawals.updateWithdrawalSchedule(editing.id, dto)
      } else {
        const dto: CreateScheduleDto = {
          dayOfWeek: schedule.dayOfWeek ?? 1,
          minAmount: (schedule.minAmount ?? 0) > 0 ? (schedule.minAmount ?? undefined) : undefined,
          bankAccountId: targetBankAccountId,
        }
        await api.withdrawals.createWithdrawalSchedule(dto)
      }
      toast.show({ title: "Jadwal disimpan", tone: "success", duration: 3000 })
      setCreating(false)
      setEditing(null)
      await query.refresh()
    } catch (err) {
      toast.show({
        title: "Gagal menyimpan jadwal",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [editing, schedule, selectedBankAccountId, toast.show, query])

  const handleToggle = useCallback(
    async (item: WithdrawalSchedule, next: boolean) => {
      setTogglingId(item.id)
      try {
        await api.withdrawals.updateWithdrawalSchedule(item.id, { isActive: next })
        // Optimistic update lewat `setData` milik useApiQuery — sama seperti
        // `setItems` sebelumnya, hanya sumber datanya kini milik hook.
        query.setData((prev) =>
          (prev ?? []).map((x) => (x.id === item.id ? { ...x, isActive: next } : x)),
        )
      } catch (err: unknown) {
        toast.show({
          title: "Gagal memperbarui jadwal",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setTogglingId(null)
      }
    },
    [toast.show],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.withdrawals.deleteWithdrawalSchedule(deleteTarget.id)
      toast.show({ title: "Jadwal dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      await query.refresh()
    } catch (err: unknown) {
      toast.show({ title: "Gagal menghapus jadwal", description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast.show, query])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Jadwal Penarikan" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={loading} skeleton={<ListLoading />}>
          {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : items.length === 0 && !creating ? (
          <EmptyState
            icon={Plus}
            title="Belum ada jadwal"
            description="Atur penarikan otomatis ke rekening Anda."
            action={
              <Button leftIcon={Plus} onPress={openCreate}>
                Buat jadwal
              </Button>
            }
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Jadwal aktif" />
            {items.map((item) => (
              <WithdrawalScheduleCard
                key={item.id}
                dayOfWeek={item.dayOfWeek}
                minAmount={item.minAmount}
                isActive={item.isActive}
                bankAccount={item.bankAccount}
                toggling={togglingId === item.id}
                onToggleActive={(next) => void handleToggle(item, next)}
                onEdit={() => openEdit(item)}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
            <Button variant="secondary" leftIcon={Plus} onPress={openCreate} disabled={creating}>
              {items.length ? "Tambah jadwal" : "Buat jadwal"}
            </Button>

            {creating || editing ? (
              <View className="gap-4">
                <SectionHeader title={editing ? "Ubah jadwal" : "Jadwal baru"} />
                {/*
                  Audit: preset sebelumnya array literal [100rb, 500rb, 1jt] di
                  JSX. Nominal uang tidak boleh diketik ulang per layar —
                  AMOUNT_PRESETS.withdraw duduk bersebelahan dengan
                  AMOUNT_LIMITS yang digenerate dari OpenAPI, jadi preset dan
                  batas kontrak tidak bisa lagi saling menyimpang.
                */}
                {!editing ? (
                  accounts.length > 0 ? (
                    <Select
                      label="Rekening Bank Tujuan"
                      value={selectedBankAccountId}
                      options={accounts.map((a) => ({
                        value: a.id,
                        label: `${a.bankName ?? a.bankCode} — ${maskAccountNumber(a.accountNumber)}`,
                        description: `a.n. ${a.accountName}${a.isPrimary ? " (Utama)" : ""}`,
                        icon: Bank,
                      }))}
                      open={bankSheetOpen}
                      onPress={() => setBankSheetOpen(true)}
                      required
                    />
                  ) : (
                    <View className="gap-2 rounded-sm border border-border-control p-4">
                      <Text variant="body" tone="danger">
                        Belum ada rekening bank terdaftar.
                      </Text>
                      <Button
                        variant="secondary"
                        onPress={() => router.push(ROUTES.bankAccounts)}
                      >
                        Tambah rekening bank
                      </Button>
                    </View>
                  )
                ) : null}

                <ScheduleField
                  value={schedule}
                  onChange={setSchedule}
                  presets={AMOUNT_PRESETS.withdraw}
                  errorText={minAmountError}
                  helperText={translate("Minimum penarikan {x}.", {
                    x: formatRupiah(AMOUNT_LIMITS.withdraw.minimum),
                  })}
                />
                <Button
                  loading={submitting}
                  disabled={Boolean(minAmountError) || (!editing && !selectedBankAccountId)}
                  onPress={() => void handleSubmit()}
                >
                  Simpan jadwal
                </Button>
                <Button
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => {
                    setCreating(false)
                    setEditing(null)
                  }}
                  disabled={submitting}
                >
                  Batal
                </Button>
              </View>
            ) : null}
            </View>
          )}
        </Crossfade>
      </PullToRefresh>

      <BottomSheet
        visible={bankSheetOpen}
        onRequestClose={() => setBankSheetOpen(false)}
        title="Pilih Rekening Tujuan"
        description="Pilih rekening bank untuk penarikan otomatis terjadwal."
      >
        <SelectOptionList
          value={selectedBankAccountId}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.bankName ?? a.bankCode} — ${maskAccountNumber(a.accountNumber)}`,
            description: `a.n. ${a.accountName}${a.isPrimary ? " (Utama)" : ""}`,
            icon: Bank,
          }))}
          onSelect={(val) => {
            setSelectedBankAccountId(val)
            setBankSheetOpen(false)
          }}
        />
      </BottomSheet>

      <Dialog
        title="Hapus jadwal?"
        description="Penarikan otomatis pada jadwal ini akan dihentikan."
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