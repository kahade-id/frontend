/**
 * Screen — Buat Transaksi (order baru) / Buat Order Link.
 *
 * POST /v1/orders/calculate-fee + /validate-counterpart live saat input
 * berubah → POST /v1/orders (mode "Lawan tertentu") atau POST
 * /v1/orders/links (mode "Order Link", tanpa lawan) pada submit. Fee
 * di-refresh paralel dengan validasi counterpart (debounce 400ms).
 *
 * Keputusan non-obvious:
 *   - Dua mode di satu form (SegmentedControl "Lawan tertentu" / "Order Link")
 *     karena DTO-nya identik kecuali `counterpartUsername` yang opsional di
 *     CreateOrderLinkDto. Order Link cocok bila lawan belum punya akun —
 *     tautan dibagikan, penerima yang menyetujui. Voucher hanya untuk order
 *     langsung (CreateOrderLinkDto tidak punya `voucherCode`).
 *   - Sukses → `router.replace` ke detail order / detail tautan (bukan
 *     sekadar toast) supaya pengguna tidak tertahan di form yang sudah
 *     terkirim dan bisa langsung membayar/membagikan.
 *   - Query `counterpart` (ROUTES.createTransactionWith) mengisi lawan lebih
 *     dulu dari profil publik; validasi tetap berjalan seperti input manual.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CheckCircle } from "phosphor-react-native"

import { api, isApiError, userMessage, type CreateOrderDto, type CreateOrderLinkDto } from "@/lib/api"
import type { FeeSchedule } from "@/lib/api/public"
import { formatDecimal, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { CounterpartValidationCard, type CounterpartState } from "@/components/ui/counterpart-validation-card"
import { FeeBreakdown } from "@/components/ui/fee-breakdown"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
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
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { VoucherRedeemBox, type AppliedVoucher } from "@/components/ui/voucher-redeem-box"

const DEBOUNCE_MS = 400
const MIN_ORDER_VALUE = 10_000
const MAX_ORDER_VALUE = 1_000_000_000
const MIN_DESCRIPTION = 10
const MIN_USERNAME = 3
const MAX_DEADLINE_DAYS = 14

type Mode = "direct" | "link"
const MODE_ITEMS: { value: Mode; label: string }[] = [
  { value: "direct", label: "Lawan tertentu" },
  { value: "link", label: "Order Link" },
]

export default function CreateTransactionScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [role, setRole] = useState<OrderRoleValue>("BUYER")
  // `counterpart` dari query (ROUTES.createTransactionWith) — profil publik
  // mengisi lawan transaksi lebih dulu; validasi tetap jalan via debounce.
  const params = useLocalSearchParams<{ counterpart?: string }>()
  const [mode, setMode] = useState<Mode>("direct")
  const [counterpart, setCounterpart] = useState(params.counterpart?.trim() ?? "")
  const [counterpartState, setCounterpartState] = useState<CounterpartState>("loading")
  const [counterpartName, setCounterpartName] = useState<string | undefined>()
  const [counterpartUsername, setCounterpartUsername] = useState<string | undefined>()
  const [counterpartVerified, setCounterpartVerified] = useState(false)
  const [counterpartWarnings, setCounterpartWarnings] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [orderType, setOrderType] = useState<OrderType>("SERVICE")
  const [orderValue, setOrderValue] = useState(0)
  const [deadlineDays, setDeadlineDays] = useState(3)
  const [feeResponsibility, setFeeResponsibility] = useState<"BUYER" | "SELLER" | "SPLIT">("SPLIT")
  const [fee, setFee] = useState<Awaited<ReturnType<typeof api.orders.calculateFee>> | null>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  // Skema biaya publik (GET /v1/public/fee-schedule) — dimuat saat sheet dibuka
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [schedule, setSchedule] = useState<FeeSchedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const openSchedule = useCallback(async () => {
    setScheduleOpen(true)
    if (schedule || scheduleLoading) return
    setScheduleLoading(true)
    try {
      setSchedule(await api.public.getFeeSchedule())
    } catch {
      setSchedule(null)
    } finally {
      setScheduleLoading(false)
    }
  }, [schedule, scheduleLoading])
  const [voucher, setVoucher] = useState<AppliedVoucher | null>(null)
  const [applyingVoucher, setApplyingVoucher] = useState(false)
  const [voucherError, setVoucherError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshFee = useCallback(async () => {
    if (orderValue < MIN_ORDER_VALUE) {
      setFee(null)
      return
    }
    setFeeLoading(true)
    try {
      const res = await api.orders.calculateFee({
        orderValue,
        feeResponsibility,
        voucherCode: voucher?.code,
        role,
      })
      setFee(res)
      setFeeLoading(false)
    } catch {
      setFeeLoading(false)
    }
  }, [orderValue, feeResponsibility, voucher?.code, role])

  const validateCounterpart = useCallback(async () => {
    const q = counterpart.trim()
    if (q.length < MIN_USERNAME) {
      setCounterpartState("loading")
      return
    }
    setCounterpartState("loading")
    try {
      const res = await api.orders.validateCounterpart({ username: q })
      setCounterpartState(res.valid ? "found" : "blocked")
      setCounterpartName(res.user?.fullName ?? q)
      setCounterpartUsername(res.user?.username ?? q)
      setCounterpartVerified(res.user?.kycVerified ?? false)
      setCounterpartWarnings(
        res.valid
          ? res.user?.kycVerified
            ? []
            : ["Lawan transaksi belum menyelesaikan verifikasi identitas"]
          : [res.reason ?? "Lawan transaksi tidak valid"]
      )
    } catch {
      setCounterpartState("notFound")
    }
  }, [counterpart])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void validateCounterpart()
      void refreshFee()
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [counterpart, orderValue, feeResponsibility, voucher?.code, role, validateCounterpart, refreshFee])

  const handleApplyVoucher = useCallback(
    async (code: string) => {
      setApplyingVoucher(true)
      setVoucherError(undefined)
      try {
        const res = await api.vouchers.validateVoucher({
          code,
          orderValue: orderValue || undefined,
          userRole: role,
        })
        if (!res.valid) {
          setVoucherError(res.message ?? "Kode voucher tidak berlaku.")
          return
        }
        const v = res.voucher
        setVoucher({
          code: v?.code ?? code,
          discount: v?.discountValue ?? 0,
          title: v?.title,
        })
      } catch {
        setVoucherError("Kode voucher tidak berlaku.")
      } finally {
        setApplyingVoucher(false)
      }
    },
    [orderValue, role],
  )

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const base = {
        role,
        title: title.trim(),
        description: description.trim(),
        orderType,
        orderValue,
        deliveryDeadlineDays: deadlineDays,
        feeResponsibility,
      }
      if (mode === "link") {
        const dto: CreateOrderLinkDto = { ...base, counterpartUsername: counterpart.trim() || undefined }
        const link = await api.orders.createOrderLink(dto)
        toast.show({ title: "Order Link dibuat", description: "Bagikan tautan ke lawan transaksi.", tone: "success", duration: 4000 })
        router.replace(link.token ? ROUTES.orderLink(link.token) : ROUTES.orderLinks)
        return
      }
      const dto: CreateOrderDto = { ...base, counterpartUsername: counterpart.trim(), voucherCode: voucher?.code }
      const order = await api.orders.createOrder(dto)
      toast.show({ title: "Transaksi dibuat", description: "Menunggu konfirmasi lawan transaksi.", tone: "success", duration: 4000 })
      router.replace(order.id ? ROUTES.orderDetail(order.id) : ROUTES.transactions)
    } catch (err) {
      toast.show({
        title: mode === "link" ? "Gagal membuat Order Link" : "Gagal membuat transaksi",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [mode, role, counterpart, title, description, orderType, orderValue, deadlineDays, feeResponsibility, voucher?.code, toast.show])

  const counterpartRequired = mode === "direct"
  const counterpartMissing = counterpartRequired && counterpart.trim().length < MIN_USERNAME
  const counterpartInvalid =
    counterpart.trim().length >= MIN_USERNAME &&
    (counterpartState === "notFound" || counterpartState === "blocked" || counterpartState === "self")

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshFee(), validateCounterpart()])
    setRefreshing(false)
  }, [refreshFee, validateCounterpart])

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        <View className="px-6 pb-4">
          <Button
            fullWidth
            loading={submitting}
            disabled={
              !title.trim() ||
              description.trim().length < MIN_DESCRIPTION ||
              orderValue < MIN_ORDER_VALUE ||
              counterpartMissing ||
              counterpartInvalid
            }
            onPress={() => void handleSubmit()}
          >
            {mode === "link" ? "Buat Order Link" : "Buat Transaksi"}
          </Button>
        </View>
      }
    >
      <Header title="Buat Transaksi" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <FormSection title="Cara membuat">
          <SegmentedControl<Mode> items={MODE_ITEMS} value={mode} onChange={setMode} />
          <Text variant="caption" tone="secondary">
            {mode === "link"
              ? "Buat tautan yang bisa dibagikan; siapa pun yang membuka dan menyetujui menjadi lawan transaksi."
              : "Transaksi langsung dikirim ke pengguna Kahade yang Anda tentukan."}
          </Text>
        </FormSection>

        <FormSection title="Peran Anda" divider>
          <OrderRoleSelector value={role} onChange={setRole} labels={ORDER_ROLE_LABELS} />
        </FormSection>

        <FormSection title="Lawan transaksi" divider>
          <Field
            label="Username lawan"
            required={counterpartRequired}
            helperText={
              counterpartRequired
                ? "Contoh: @johndoe — tanpa @"
                : "Opsional — kosongkan agar siapa pun bisa menerima tautan"
            }
          >
            <Input
              value={counterpart}
              onChangeText={setCounterpart}
              placeholder="johndoe"
              autoCapitalize="none"
              maxLength={50}
            />
          </Field>
          {counterpart.trim().length >= MIN_USERNAME ? (
            <CounterpartValidationCard
              state={counterpartState}
              name={counterpartName}
              username={counterpartUsername}
              verified={counterpartVerified}
              warnings={counterpartWarnings}
            />
          ) : null}
        </FormSection>

        <FormSection title="Detail pesanan" divider>
          <Field label="Judul" required>
            <Input value={title} onChangeText={setTitle} placeholder="Jasa desain logo" maxLength={100} />
          </Field>
          <Field label="Deskripsi" required>
            <TextArea
              value={description}
              onChangeText={setDescription}
              placeholder="Jelaskan detail pekerjaan (min. 10 karakter)"
              maxLength={500}
              numberOfLines={4}
            />
          </Field>
          <Field label="Jenis transaksi" required>
            <OrderTypeSelector value={orderType} onChange={setOrderType} labels={ORDER_TYPE_LABELS} />
          </Field>
          <AmountInput
            value={orderValue}
            onChange={setOrderValue}
            min={MIN_ORDER_VALUE}
            max={MAX_ORDER_VALUE}
            label="Nilai transaksi"
          />
        </FormSection>

        <FormSection title="Biaya & tenggat" divider>
          <Field label="Tenggat pengiriman (hari)" required helperText={`1–${MAX_DEADLINE_DAYS} hari`}>
            <Input
              value={String(deadlineDays)}
              onChangeText={(t) => {
                const n = Number.parseInt(t.replace(/\D/g, ""), 10)
                setDeadlineDays(Number.isFinite(n) ? Math.min(MAX_DEADLINE_DAYS, Math.max(1, n)) : 1)
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Field>
          <Field label="Pembayar biaya" required>
            <FeeResponsibilitySelector value={feeResponsibility} onChange={setFeeResponsibility} feeAmount={fee?.platformFee ?? 0} viewer={role} />
          </Field>
          <Button variant="ghost" size="sm" onPress={() => void openSchedule()}>
            Lihat skema biaya platform
          </Button>
          {fee ? (
            <FeeBreakdown
              orderValue={orderValue}
              feeAmount={fee.platformFee}
              feeResponsibility={feeResponsibility}
              role={role === "BUYER" ? "BUYER" : "SELLER"}
              discountAmount={fee.discount ?? voucher?.discount}
              loading={feeLoading}
            />
          ) : null}
        </FormSection>

        {mode === "direct" ? (
          <FormSection title="Voucher" divider>
            <VoucherRedeemBox
              applied={voucher ?? undefined}
              onApply={(code) => void handleApplyVoucher(code)}
              onRemove={() => setVoucher(null)}
              applying={applyingVoucher}
              errorText={voucherError}
            />
          </FormSection>
        ) : null}

        <View style={{ marginTop: tokens.space[2] }} className="items-center">
          <Button variant="ghost" fullWidth={false} leftIcon={CheckCircle} disabled>
            {orderValue > 0 ? `Total: ${formatRupiah(fee?.buyerPays ?? orderValue)}` : "Ringkasan muncul setelah nilai diisi"}
          </Button>
        </View>
      </PullToRefresh>
      <BottomSheet
        visible={scheduleOpen}
        onRequestClose={() => setScheduleOpen(false)}
        title="Skema biaya platform"
        description="Biaya dihitung dari nilai transaksi menurut tingkatan berikut. Angka pasti untuk order ini tampil di rincian biaya."
      >
        {scheduleLoading ? (
          <Text variant="body" tone="secondary">
            Memuat skema biaya…
          </Text>
        ) : !schedule || schedule.tiers.length === 0 ? (
          <Text variant="body" tone="secondary">
            Skema biaya belum tersedia. Rincian biaya tetap dihitung otomatis saat nilai transaksi diisi.
          </Text>
        ) : (
          <KeyValueList>
            {schedule.tiers.map((t, i) => (
              <KeyValue
                key={`${t.minValue}-${t.maxValue ?? "max"}-${i}`}
                label={
                  t.maxValue == null
                    ? `≥ ${formatRupiah(t.minValue)}`
                    : `${formatRupiah(t.minValue)} – ${formatRupiah(t.maxValue)}`
                }
                value={[
                  t.feePercent != null ? `${formatDecimal(t.feePercent, 2)}%` : null,
                  t.feeFlat != null ? formatRupiah(t.feeFlat) : null,
                ]
                  .filter(Boolean)
                  .join(" + ") || "—"}
              />
            ))}
            {schedule.minFee != null ? <KeyValue label="Biaya minimum" value={formatRupiah(schedule.minFee)} /> : null}
            {schedule.maxFee != null ? <KeyValue label="Biaya maksimum" value={formatRupiah(schedule.maxFee)} /> : null}
          </KeyValueList>
        )}
      </BottomSheet>
    </Screen>
  )
}
