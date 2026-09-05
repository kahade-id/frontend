/**
 * Screen — Buat Transaksi (order baru).
 *
 * POST /v1/orders/calculate-fee + /validate-counterpart live saat input
 * berubah → POST /v1/orders pada submit. Fee di-refresh paralel dengan
 * validasi counterpart (debounce 400ms).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CheckCircle } from "phosphor-react-native"

import { api, type CreateOrderDto } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { Button } from "@/components/ui/button"
import { CounterpartValidationCard, type CounterpartState } from "@/components/ui/counterpart-validation-card"
import { FeeBreakdown } from "@/components/ui/fee-breakdown"
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
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { VoucherRedeemBox, type AppliedVoucher } from "@/components/ui/voucher-redeem-box"

const DEBOUNCE_MS = 400
const MIN_ORDER_VALUE = 10_000
const MAX_ORDER_VALUE = 1_000_000_000

export default function CreateTransactionScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [role, setRole] = useState<OrderRoleValue>("BUYER")
  const [counterpart, setCounterpart] = useState("")
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
    if (q.length < 3) {
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
      const dto: CreateOrderDto = {
        role,
        counterpartUsername: counterpart.trim(),
        title: title.trim(),
        description: description.trim(),
        orderType,
        orderValue,
        deliveryDeadlineDays: deadlineDays,
        feeResponsibility,
        voucherCode: voucher?.code,
      }
      await api.orders.createOrder(dto)
      toast.show({ title: "Transaksi dibuat", description: "Menunggu konfirmasi lawan transaksi.", tone: "success", duration: 4000 })
      // kembali ke tab transaksi
    } catch {
      toast.show({ title: "Gagal membuat transaksi", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [role, counterpart, title, description, orderType, orderValue, deadlineDays, feeResponsibility, voucher?.code, toast.show])

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
              description.trim().length < 10 ||
              orderValue < MIN_ORDER_VALUE ||
              counterpart.trim().length < 3
            }
            onPress={() => void handleSubmit()}
          >
            Buat Transaksi
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
        <FormSection title="Peran Anda">
          <OrderRoleSelector value={role} onChange={setRole} labels={ORDER_ROLE_LABELS} />
        </FormSection>

        <FormSection title="Lawan transaksi" divider>
          <Field label="Username lawan" required helperText="Contoh: @johndoe — tanpa @">
            <Input
              value={counterpart}
              onChangeText={setCounterpart}
              placeholder="johndoe"
              autoCapitalize="none"
              maxLength={50}
            />
          </Field>
          <CounterpartValidationCard
            state={counterpartState}
            name={counterpartName}
            username={counterpartUsername}
            verified={counterpartVerified}
            warnings={counterpartWarnings}
          />
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
          <Field label="Tenggat pengiriman (hari)" required helperText="1–14 hari">
            <Input
              value={String(deadlineDays)}
              onChangeText={(t) => {
                const n = Number.parseInt(t.replace(/\D/g, ""), 10)
                setDeadlineDays(Number.isFinite(n) ? Math.min(14, Math.max(1, n)) : 1)
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Field>
          <Field label="Pembayar biaya" required>
            <FeeResponsibilitySelector value={feeResponsibility} onChange={setFeeResponsibility} feeAmount={fee?.platformFee ?? 0} viewer={role} />
          </Field>
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

        <FormSection title="Voucher" divider>
          <VoucherRedeemBox
            applied={voucher ?? undefined}
            onApply={(code) => void handleApplyVoucher(code)}
            onRemove={() => setVoucher(null)}
            applying={applyingVoucher}
            errorText={voucherError}
          />
        </FormSection>

        <View style={{ marginTop: tokens.space[2] }} className="items-center">
          <Button variant="ghost" fullWidth={false} leftIcon={CheckCircle} disabled>
            {orderValue > 0 ? `Total: ${formatRupiah(fee?.buyerPays ?? orderValue)}` : "Ringkasan muncul setelah nilai diisi"}
          </Button>
        </View>
      </PullToRefresh>
    </Screen>
  )
}
