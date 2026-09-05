import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Jadwal Penarikan Otomatis (GET/POST/PUT/DELETE /v1/withdrawals/schedules).
 * Memakai WithdrawalScheduleCard + ScheduleField (hari + nominal minimum).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Plus } from "phosphor-react-native"

import { api, type CreateScheduleDto, type UpdateScheduleDto } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { AMOUNT_LIMITS, AMOUNT_PRESETS } from "@/lib/financial"
import type { WithdrawalSchedule } from "@/lib/api/withdrawals"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { ScheduleField, type ScheduleValue } from "@/components/ui/schedule-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { WithdrawalScheduleCard } from "@/components/ui/withdrawal-schedule-card"

export default function WithdrawalSchedulesScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<WithdrawalSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [editing, setEditing] = useState<WithdrawalSchedule | null>(null)
  const [creating, setCreating] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleValue>({ dayOfWeek: 1, minAmount: 0 })
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WithdrawalSchedule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.withdrawals.listWithdrawalSchedules()
      setItems(list ?? [])
    } catch {
      setError("Gagal memuat jadwal penarikan.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const openCreate = useCallback(() => {
    setEditing(null)
    setCreating(true)
    setSchedule({ dayOfWeek: 1, minAmount: 0 })
  }, [])

  const openEdit = useCallback((s: WithdrawalSchedule) => {
    setEditing(s)
    setCreating(false)
    setSchedule({ dayOfWeek: s.dayOfWeek, minAmount: s.minAmount ?? 0 })
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
          bankAccountId: "",
        }
        await api.withdrawals.createWithdrawalSchedule(dto)
      }
      toast.show({ title: "Jadwal disimpan", tone: "success", duration: 3000 })
      setCreating(false)
      setEditing(null)
      await fetchAll()
    } catch (err) {
      toast.show({
        title: "Gagal menyimpan jadwal",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [editing, schedule, toast.show, fetchAll])

  const handleToggle = useCallback(
    async (item: WithdrawalSchedule, next: boolean) => {
      setTogglingId(item.id)
      try {
        await api.withdrawals.updateWithdrawalSchedule(item.id, { isActive: next })
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isActive: next } : x)))
      } catch {
        toast.show({ title: "Gagal memperbarui jadwal", tone: "danger" })
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
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal menghapus jadwal", tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast.show, fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Jadwal Penarikan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 && !creating ? (
          <EmptyState
            icon={Plus}
            title="Belum ada jadwal"
            description="Atur penarikan otomatis ke rekening Anda."
            action={
              <Button leftIcon={Plus} onPress={openCreate}>
                Buat Jadwal
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
              {items.length ? "Tambah Jadwal" : "Buat Jadwal"}
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
                <ScheduleField
                  value={schedule}
                  onChange={setSchedule}
                  presets={AMOUNT_PRESETS.withdraw}
                  errorText={minAmountError}
                  helperText={`Minimum penarikan ${formatRupiah(AMOUNT_LIMITS.withdraw.minimum)}.`}
                />
                <Button
                  loading={submitting}
                  disabled={Boolean(minAmountError)}
                  onPress={() => void handleSubmit()}
                >
                  Simpan Jadwal
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
      </PullToRefresh>

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
