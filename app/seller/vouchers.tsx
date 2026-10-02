/**
 * Screen — Voucher Toko (batch 43, item 9, sisi penjual).
 *
 * Kelola voucher buatan penjual: daftar (GET /v1/seller-vouchers/mine),
 * buat (POST /v1/seller-vouchers), nonaktifkan (PATCH /:id/deactivate).
 * Voucher dipakai pembeli di checkout (validasi POST /v1/seller-vouchers/validate).
 *
 * Keputusan non-obvious:
 * - Kode 4–24 karakter (kontrak backend); input di-uppercase otomatis.
 * - validFrom default sekarang, validUntil default +30 hari; input tanggal
 *   memakai DatePickerSheet (pola create-transaction, tanpa native module).
 * - Angka tampil apa adanya dari server; klien tidak menghitung ulang
 *   kelayakan — validasi kelayakan hanya di checkout via endpoint validate.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { DotsThreeVertical, Plus, Power, Ticket } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import {
  type CreateSellerVoucherDto,
  type SellerVoucher,
  type SellerVoucherType,
} from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { formatRupiah, formatDateLong } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"
import { useToast } from "@/components/ui/toast"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { DatePickerSheet } from "@/components/ui/date-picker-sheet"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"

const TYPE_OPTIONS: { value: SellerVoucherType; label: string }[] = [
  { value: "NOMINAL", label: "Nominal (Rp)" },
  { value: "PERSEN", label: "Persen (%)" },
]

type FormState = {
  code: string
  name: string
  description: string
  voucherType: SellerVoucherType
  discountAmount: string
  discountPercent: string
  maxDiscountAmount: string
  maxUsageTotal: string
  maxUsagePerUser: string
  minOrderValue: string
  validFrom: Date | null
  validUntil: Date | null
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  description: "",
  voucherType: "NOMINAL",
  discountAmount: "",
  discountPercent: "",
  maxDiscountAmount: "",
  maxUsageTotal: "",
  maxUsagePerUser: "1",
  minOrderValue: "",
  validFrom: null,
  validUntil: null,
}

function discountText(v: SellerVoucher): string {
  if (v.voucherType === "PERSEN" && v.discountPercent != null) {
    const cap =
      v.maxDiscountAmountIdr != null ? ` (maks ${formatRupiah(v.maxDiscountAmountIdr)})` : ""
    return `${v.discountPercent}%${cap}`
  }
  // R4/P2-08 (audit non-escrow 2026-10-03): nominal null ≠ Rp0 — jangan
  // tampilkan "Diskon Rp0" yang menyesatkan.
  if (v.discountAmountIdr == null) return translate("Belum tersedia")
  return formatRupiah(v.discountAmountIdr)
}

export default function SellerVouchersScreen() {
  const hasSession = useHasSession()
  const toast = useToast()
  const query = useApiQuery<SellerVoucher[]>(
    "seller-vouchers-mine",
    (signal) => api.commerce.listMySellerVouchers(1, 50, signal),
    hasSession,
  )
  const vouchers = query.data ?? []

  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [dateTarget, setDateTarget] = useState<"from" | "until" | null>(null)
  const [menuVoucher, setMenuVoucher] = useState<SellerVoucher | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<SellerVoucher | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const openCreate = useCallback(() => {
    const now = new Date()
    const until = new Date(now)
    until.setDate(until.getDate() + 30)
    setForm({ ...EMPTY_FORM, validFrom: now, validUntil: until })
    setFormError(undefined)
    setSheetOpen(true)
  }, [])

  const validate = (f: FormState): string | null => {
    const code = f.code.trim().toUpperCase()
    if (code.length < 4 || code.length > 24) return translate("Kode 4–24 karakter.")
    if (!f.name.trim()) return translate("Nama voucher wajib diisi.")
    if (f.voucherType === "NOMINAL") {
      const amt = Number.parseInt(f.discountAmount, 10) || 0
      if (amt <= 0) return translate("Nominal diskon harus lebih dari 0.")
    } else {
      const pct = Number.parseInt(f.discountPercent, 10) || 0
      if (pct < 1 || pct > 100) return translate("Persen diskon 1–100.")
    }
    if (!f.validFrom || !f.validUntil) return translate("Masa berlaku wajib diisi.")
    if (f.validUntil <= f.validFrom) return translate("Tanggal berakhir harus setelah tanggal mulai.")
    return null
  }

  const handleSave = useCallback(async () => {
    if (saving) return
    const error = validate(form)
    if (error) {
      setFormError(error)
      return
    }
    setSaving(true)
    const num = (s: string): number | undefined => {
      const n = Number.parseInt(s, 10)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    const dto: CreateSellerVoucherDto = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      voucherType: form.voucherType,
      discountAmountIdr: form.voucherType === "NOMINAL" ? num(form.discountAmount) : undefined,
      discountPercent: form.voucherType === "PERSEN" ? num(form.discountPercent) : undefined,
      maxDiscountAmountIdr: num(form.maxDiscountAmount),
      maxUsageTotal: num(form.maxUsageTotal),
      maxUsagePerUser: num(form.maxUsagePerUser),
      minOrderValueIdr: num(form.minOrderValue),
      validFrom: form.validFrom!.toISOString(),
      validUntil: form.validUntil!.toISOString(),
    }
    try {
      await api.commerce.createSellerVoucher(dto)
      toast.show({ title: translate("Voucher dibuat"), tone: "success" })
      setSheetOpen(false)
      await query.refresh()
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, form, toast, query])

  const handleDeactivate = useCallback(async () => {
    if (!deactivateTarget || deactivating) return
    setDeactivating(true)
    try {
      await api.commerce.deactivateSellerVoucher(deactivateTarget.id)
      toast.show({ title: translate("Voucher dinonaktifkan"), tone: "success" })
      setDeactivateTarget(null)
      await query.refresh()
    } catch (err) {
      toast.show({ title: translate("Gagal menonaktifkan"), description: userMessage(err), tone: "danger" })
    } finally {
      setDeactivating(false)
    }
  }, [deactivateTarget, deactivating, toast, query])

  const menuActions: ActionSheetItem[] = menuVoucher?.isActive
    ? [
        {
          key: "deactivate",
          label: translate("Nonaktifkan"),
          icon: Power,
          destructive: true,
          onPress: () => {
            setMenuVoucher(null)
            setDeactivateTarget(menuVoucher)
          },
        },
      ]
    : []

  if (!hasSession) {
    return (
      <GuestLoginPrompt next="/seller/vouchers" />
    )
  }

  return (
    <DataScreen
      title={translate("Voucher toko")}
      header={{
        right: (
          <IconButton
            icon={Plus}
            accessibilityLabel={translate("Buat voucher")}
            onPress={openCreate}
          />
        ),
      }}
      state={query}
      loadingMessage={translate("Memuat voucher")}
      errorTitle={translate("Gagal memuat voucher")}
      empty={
        vouchers.length === 0
          ? {
              icon: Ticket,
              title: translate("Belum ada voucher"),
              description: translate("Buat voucher toko untuk menarik pembeli — berlaku khusus di tokomu."),
              action: (
                <Button fullWidth={false} onPress={openCreate}>
                  {translate("Buat voucher")}
                </Button>
              ),
            }
          : undefined
      }
    >
      <View className="gap-3">
        {vouchers.map((v) => (
          <Card key={v.id} variant="elevated" className="gap-2 p-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={Ticket} size="sm" tone="default" />
              <Text variant="body" weight={700} className="flex-1 tabular-nums" numberOfLines={1}>
                {v.code}
              </Text>
              <Badge tone={v.isActive ? "success" : "neutral"}>
                {v.isActive ? translate("Aktif") : translate("Nonaktif")}
              </Badge>
              {v.isActive ? (
                <IconButton
                  icon={DotsThreeVertical}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={translate("Opsi voucher {x}", { x: v.code })}
                  onPress={() => setMenuVoucher(v)}
                />
              ) : null}
            </View>
            <Text variant="body" weight={600}>
              {v.name}
            </Text>
            <Text variant="caption" tone="secondary">
              {translate("Diskon {x}", { x: discountText(v) })}
              {v.minOrderValueIdr != null
                ? translate(" · min. belanja {x}", { x: formatRupiah(v.minOrderValueIdr) })
                : ""}
            </Text>
            {v.validFrom || v.validUntil ? (
              <Text variant="caption" tone="tertiary">
                {v.validFrom ? formatDateLong(new Date(v.validFrom)) : "—"}
                {" – "}
                {v.validUntil ? formatDateLong(new Date(v.validUntil)) : "—"}
              </Text>
            ) : null}
            {v.usedCount != null || v.maxUsageTotal != null ? (
              <Text variant="caption" tone="tertiary">
                {translate("Terpakai {x}{y}", {
                  x: v.usedCount ?? 0,
                  y: v.maxUsageTotal != null ? `/${v.maxUsageTotal}` : "",
                })}
              </Text>
            ) : null}
          </Card>
        ))}
      </View>

      <ActionSheet
        visible={menuVoucher != null}
        onRequestClose={() => setMenuVoucher(null)}
        actions={menuActions}
      />

      <Dialog
        title={translate("Nonaktifkan voucher ini?")}
        description={translate("Kode \"{x}\" tidak bisa dipakai lagi oleh pembeli.", {
          x: deactivateTarget?.code ?? "",
        })}
        visible={deactivateTarget != null}
        destructive
        loading={deactivating}
        confirmLabel={translate("Nonaktifkan")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => setDeactivateTarget(null)}
        onRequestClose={() => setDeactivateTarget(null)}
      />

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Buat voucher toko")}
        // UX-SPA-005: sheet berisi ~10 input + CTA — keyboard menutupi field
        // bawah & CTA di iOS tanpa ini (pola FRM-017).
        avoidKeyboard
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleSave()}>
            {translate("Buat voucher")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("Kode voucher")}
            value={form.code}
            onChangeText={(t) => setForm((f) => ({ ...f, code: t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) }))}
            placeholder="HEMAT10"
            maxLength={24}
            autoCapitalize="characters"
          />
          <Input
            label={translate("Nama voucher")}
            value={form.name}
            onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
            placeholder={translate("Diskon pembukaan toko")}
            maxLength={80}
          />
          <Input
            label={translate("Deskripsi (opsional)")}
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            maxLength={300}
            multiline
          />
          <Field label={translate("Tipe diskon")}>
            <SegmentedControl<SellerVoucherType>
              items={TYPE_OPTIONS}
              value={form.voucherType}
              onChange={(voucherType) => setForm((f) => ({ ...f, voucherType }))}
              accessibilityLabel={translate("Tipe diskon")}
            />
          </Field>
          {form.voucherType === "NOMINAL" ? (
            <Input
              label={translate("Nominal diskon (Rp)")}
              value={form.discountAmount}
              onChangeText={(t) => setForm((f) => ({ ...f, discountAmount: t.replace(/\D/g, "") }))}
              keyboardType="number-pad"
              maxLength={12}
            />
          ) : (
            <View className="gap-4">
              <Input
                label={translate("Persen diskon (1–100)")}
                value={form.discountPercent}
                onChangeText={(t) => setForm((f) => ({ ...f, discountPercent: t.replace(/\D/g, "").slice(0, 3) }))}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Input
                label={translate("Maksimal potongan Rp (opsional)")}
                value={form.maxDiscountAmount}
                onChangeText={(t) => setForm((f) => ({ ...f, maxDiscountAmount: t.replace(/\D/g, "") }))}
                keyboardType="number-pad"
                maxLength={12}
              />
            </View>
          )}
          <View className="flex-row gap-3">
            <Input
              label={translate("Min. belanja (Rp)")}
              value={form.minOrderValue}
              onChangeText={(t) => setForm((f) => ({ ...f, minOrderValue: t.replace(/\D/g, "") }))}
              keyboardType="number-pad"
              maxLength={12}
              containerClassName="flex-1"
            />
            <Input
              label={translate("Kuota total")}
              value={form.maxUsageTotal}
              onChangeText={(t) => setForm((f) => ({ ...f, maxUsageTotal: t.replace(/\D/g, "") }))}
              keyboardType="number-pad"
              maxLength={7}
              containerClassName="flex-1"
            />
          </View>
          <Input
            label={translate("Maks. pakai per user")}
            value={form.maxUsagePerUser}
            onChangeText={(t) => setForm((f) => ({ ...f, maxUsagePerUser: t.replace(/\D/g, "") }))}
            keyboardType="number-pad"
            maxLength={3}
          />
          <View className="flex-row gap-3">
            <Field label={translate("Berlaku dari")} className="flex-1">
              <Button
                variant="secondary"
                onPress={() => setDateTarget("from")}
              >
                {form.validFrom ? formatDateLong(form.validFrom) : translate("Pilih")}
              </Button>
            </Field>
            <Field label={translate("Berlaku sampai")} className="flex-1">
              <Button
                variant="secondary"
                onPress={() => setDateTarget("until")}
              >
                {form.validUntil ? formatDateLong(form.validUntil) : translate("Pilih")}
              </Button>
            </Field>
          </View>
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <DatePickerSheet
        visible={dateTarget != null}
        onRequestClose={() => setDateTarget(null)}
        value={dateTarget === "from" ? form.validFrom : form.validUntil}
        onSelect={(date) => {
          setForm((f) => (dateTarget === "from" ? { ...f, validFrom: date } : { ...f, validUntil: date }))
          setDateTarget(null)
        }}
      />
    </DataScreen>
  )
}
