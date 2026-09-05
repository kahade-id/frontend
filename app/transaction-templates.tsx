import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Template Transaksi (CRUD /v1/transaction-templates).
 * Template = data order default (role, judul, jenis, nilai, tenggat, fee).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { NotePencil } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { TransactionTemplate as ApiTemplate } from "@/lib/api/transaction-templates"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import {
  FeeResponsibilitySelector,
  OrderRoleSelector,
  OrderTypeSelector,
  ORDER_ROLE_LABELS,
  ORDER_TYPE_LABELS,
  type OrderRoleValue,
  type OrderType,
} from "@/components/ui/order-form-selectors"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import {
  TransactionTemplateCard,
  type TransactionTemplate as UiTemplate,
} from "@/components/ui/transaction-template-card"
import { useToast } from "@/components/ui/toast"

const NO_TEMPLATE: ApiTemplate = {
  id: "",
  name: "",
  role: "BUYER",
  title: "",
  orderType: "SERVICE",
  orderValue: 0,
  deliveryDeadlineDays: 7,
  feeResponsibility: "SPLIT",
}

export default function TransactionTemplatesScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<ApiTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState<ApiTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ApiTemplate>(NO_TEMPLATE)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.transactionTemplates.listTransactionTemplates()
      setItems(res ?? [])
    } catch (err) {
      setError(userMessage(err))
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
    setForm(NO_TEMPLATE)
  }, [])

  const openEdit = useCallback((t: UiTemplate) => {
    setEditing(t)
    setCreating(true)
    setForm({ ...NO_TEMPLATE, ...t, counterpartUsername: t.counterpartUsername ?? "" })
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.title.trim() || form.orderValue <= 0) return
    setSubmitting(true)
    try {
      const dto = {
        name: form.name.trim(),
        role: form.role,
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        orderType: form.orderType,
        orderValue: form.orderValue,
        deliveryDeadlineDays: form.deliveryDeadlineDays,
        feeResponsibility: form.feeResponsibility,
        counterpartUsername: form.counterpartUsername?.trim() || undefined,
      }
      if (editing) {
        await api.transactionTemplates.updateTransactionTemplate(editing.id, dto)
      } else {
        await api.transactionTemplates.createTransactionTemplate(dto)
      }
      toast.show({ title: "Template disimpan", tone: "success", duration: 3000 })
      setCreating(false)
      setEditing(null)
      await fetchAll()
    } catch (err: unknown) {
      toast.show({
        title: "Gagal menyimpan template",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [form, editing, toast.show, fetchAll])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.transactionTemplates.deleteTransactionTemplate(deleteTarget.id)
      toast.show({ title: "Template dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      await fetchAll()
    } catch (err: unknown) {
      toast.show({
        title: "Gagal menghapus template",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast.show, fetchAll])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Template Transaksi" />
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
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Template cepat" />
            {items.length === 0 && !creating ? (
              <EmptyState
                icon={NotePencil}
                title="Belum ada template"
                action={<Button onPress={openCreate}>Buat Template</Button>}
              />
            ) : (
              items.map((t) => (
                <TransactionTemplateCard
                  key={t.id}
                  template={{
                    id: t.id,
                    name: t.name,
                    role: t.role,
                    title: t.title,
                    description: t.description,
                    orderType: t.orderType,
                    orderValue: t.orderValue,
                    deliveryDeadlineDays: t.deliveryDeadlineDays,
                    feeResponsibility: t.feeResponsibility,
                    counterpartUsername: t.counterpartUsername ?? undefined,
                    usageCount: t.usageCount,
                  }}
                  onEdit={openEdit}
                  onDelete={() => setDeleteTarget(t)}
                />
              ))
            )}

            {!creating ? (
              <Button variant="secondary" onPress={openCreate}>
                Buat Template
              </Button>
            ) : (
              <FormSection title={editing ? "Ubah template" : "Template baru"}>
                <Field label="Nama template" required>
                  <Input
                    value={form.name}
                    onChangeText={(v) => setForm({ ...form, name: v })}
                    maxLength={50}
                    placeholder="Mis. Jasa desain logo"
                  />
                </Field>
                <Field label="Peran" required>
                  <OrderRoleSelector
                    value={form.role as OrderRoleValue}
                    onChange={(v) => setForm({ ...form, role: v })}
                    labels={ORDER_ROLE_LABELS}
                  />
                </Field>
                <Field label="Judul order default" required>
                  <Input
                    value={form.title}
                    onChangeText={(v) => setForm({ ...form, title: v })}
                    maxLength={100}
                    placeholder="Jasa desain logo"
                  />
                </Field>
                <Field label="Jenis" required>
                  <OrderTypeSelector
                    value={form.orderType as OrderType}
                    onChange={(v) => setForm({ ...form, orderType: v })}
                    labels={ORDER_TYPE_LABELS}
                  />
                </Field>
                <AmountInput
                  value={form.orderValue}
                  onChange={(v) => setForm({ ...form, orderValue: v })}
                  min={10_000}
                  label="Nilai order default"
                />
                <Field label="Tenggat (hari)" required>
                  <Input
                    value={String(form.deliveryDeadlineDays)}
                    onChangeText={(v) => {
                      const n = Number.parseInt(v.replace(/\D/g, ""), 10)
                      setForm({
                        ...form,
                        deliveryDeadlineDays: Number.isFinite(n) ? Math.min(14, Math.max(1, n)) : 1,
                      })
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </Field>
                <Field label="Pembayar biaya" required>
                  <FeeResponsibilitySelector
                    value={form.feeResponsibility as "BUYER" | "SELLER" | "SPLIT"}
                    onChange={(v) => setForm({ ...form, feeResponsibility: v })}
                    viewer={form.role}
                  />
                </Field>
                <Field
                  label="Username lawan (opsional)"
                  helperText="Bila diisi, template hanya berlaku untuk lawan ini"
                >
                  <Input
                    value={form.counterpartUsername ?? ""}
                    onChangeText={(v) => setForm({ ...form, counterpartUsername: v })}
                    autoCapitalize="none"
                    maxLength={50}
                    placeholder="@username"
                  />
                </Field>
                <Button
                  loading={submitting}
                  disabled={!form.name.trim() || !form.title.trim() || form.orderValue <= 0}
                  onPress={() => void handleSave()}
                >
                  Simpan Template
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
              </FormSection>
            )}
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Hapus template?"
        description="Template ini akan dihapus dari daftar."
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
