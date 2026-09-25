/**
 * Kahade — seksi langkah tinjau (step 3) layar Buat Transaksi.
 *
 * R2 (audit ronde-2, butir #96): diekstrak dari `app/create-transaction.tsx`
 * murni untuk menahan pelanggaran ratchet ukuran layar — perilaku, struktur
 * JSX, dan komentar audit yang relevan DIPINDAH apa adanya.
 */
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { CounterpartValidationCard, type CounterpartState } from "@/components/ui/counterpart-validation-card"
import { Input } from "@/components/ui/input"
import { OrderRoleSelector } from "@/components/ui/order-form-selectors"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { translate } from "@/lib/i18n/translate"
import { Button } from "@/components/ui/button"
import { FEE_RESPONSIBILITY_LABELS, FeeBreakdown } from "@/components/ui/fee-breakdown"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import {
  FeeResponsibilitySelector,
  ORDER_ROLE_LABELS,
  ORDER_TYPE_LABELS,
  type OrderRoleValue,
  type OrderType,
} from "@/components/ui/order-form-selectors"
import { Text } from "@/components/ui/text"
import { VoucherRedeemBox, type AppliedVoucher } from "@/components/ui/voucher-redeem-box"
import type { FeeSchedule } from "@/lib/api/public"
import { formatDecimal, formatRupiah } from "@/lib/format"

type Mode = "direct" | "link"

const MODE_ITEMS: { value: Mode; label: string }[] = [
  { value: "direct", label: "Lawan tertentu" },
  { value: "link", label: "Order Link" },
]

/** Langkah 0: cara membuat + peran pengguna pada transaksi. */
export function CreateIntroStep({
  mode,
  onChangeMode,
  role,
  onChangeRole,
}: {
  mode: Mode
  onChangeMode: (mode: Mode) => void
  role: OrderRoleValue
  onChangeRole: (role: OrderRoleValue) => void
}) {
  return (
    <>
      <FormSection title="Cara membuat">
        <SegmentedControl<Mode>
          accessibilityLabel="Cara membuat transaksi"
          items={MODE_ITEMS}
          value={mode}
          onChange={onChangeMode}
        />
        <Text variant="caption" tone="secondary">
          {mode === "link"
            ? "Buat tautan yang bisa dibagikan; siapa pun yang membuka dan menyetujui menjadi lawan transaksi."
            : "Transaksi langsung dikirim ke pengguna Kahade yang Anda tentukan."}
        </Text>
      </FormSection>

      <FormSection title="Peran Anda" divider>
        <OrderRoleSelector value={role} onChange={onChangeRole} labels={ORDER_ROLE_LABELS} />
      </FormSection>
    </>
  )
}

/** Langkah 1: username lawan + kartu validasi. */
export function CounterpartStep({
  value,
  onChange,
  required,
  minUsername,
  state,
  name,
  username,
  verified,
  warnings,
  reason,
}: {
  value: string
  onChange: (value: string) => void
  required: boolean
  minUsername: number
  state: CounterpartState
  name?: string
  username?: string
  verified?: boolean
  warnings?: readonly string[]
  reason?: string
}) {
  return (
    <FormSection title="Lawan transaksi">
      <Field
        label="Username lawan"
        required={required}
        helperText={
          required ? "Contoh: @johndoe — tanpa @" : "Opsional — kosongkan agar siapa pun bisa menerima tautan"
        }
      >
        <Input
          value={value}
          onChangeText={onChange}
          placeholder="johndoe"
          autoCapitalize="none"
          // Username bukan prosa: autocorrect/predictive text akan menulis
          // ulang "johndoe" jadi kata kamus dan mengusulkan spasi. Field
          // serupa di <UsernameField> sudah mematikan keduanya.
          autoCorrect={false}
          spellCheck={false}
          // Jangan tawarkan autofill identitas pengguna sendiri — ini
          // username LAWAN transaksi.
          autoComplete="off"
          textContentType="none"
          returnKeyType="next"
          maxLength={50}
        />
      </Field>
      {value.trim().length >= minUsername ? (
        <CounterpartValidationCard
          state={state}
          name={name}
          username={username}
          verified={verified}
          warnings={warnings}
          reason={reason}
        />
      ) : value.trim().length > 0 ? (
        // R2 (audit ronde-2, butir #59): tanpa kartu & tanpa pesan, pengguna
        // yang berhenti di 2 karakter menunggu jawaban yang tak pernah
        // datang. Arahkan eksplisit ke panjang minimum.
        <Text variant="caption" tone="secondary">
          {translate("Username minimal {x} karakter.", { x: minUsername })}
        </Text>
      ) : null}
    </FormSection>
  )
}

export type ReviewFee = {
  platformFee: number
  discount?: number | null
  buyerPays?: number
  sellerReceives?: number
} | null

export function FeeServiceSection({
  feeResponsibility,
  onChangeFeeResponsibility,
  feeConfirmed,
  fee,
  role,
  orderValue,
  voucherDiscount,
  feeLoading,
  onOpenSchedule,
}: {
  feeResponsibility: "BUYER" | "SELLER" | "SPLIT"
  onChangeFeeResponsibility: (value: "BUYER" | "SELLER" | "SPLIT") => void
  feeConfirmed: boolean
  fee: ReviewFee
  role: OrderRoleValue
  orderValue: number
  voucherDiscount?: number
  feeLoading: boolean
  onOpenSchedule: () => void
}) {
  return (
    <FormSection title="Biaya layanan">
      <Field label="Pembayar biaya" required>
        <FeeResponsibilitySelector
          value={feeResponsibility}
          onChange={onChangeFeeResponsibility}
          feeAmount={feeConfirmed ? fee?.platformFee : undefined}
          viewer={role}
        />
      </Field>
      <Button variant="ghost" size="sm" onPress={onOpenSchedule}>
        Lihat skema biaya platform
      </Button>
      {feeConfirmed && fee ? (
        <FeeBreakdown
          orderValue={orderValue}
          feeAmount={fee.platformFee}
          feeResponsibility={feeResponsibility}
          role={role === "BUYER" ? "BUYER" : "SELLER"}
          discountAmount={fee.discount ?? voucherDiscount}
          // M-25 (audit end-to-end, issue #15): angka SERVER (B-01) diteruskan
          // — dulu hanya detail order yang memakai buyerPays/sellerGets
          // server; preview create-order memakai fallback lokal terus sehingga
          // voucher SPLIT salah hitung.
          buyerPays={fee.buyerPays}
          sellerGets={fee.sellerReceives}
          loading={feeLoading}
        />
      ) : (
        <Text variant="body" tone="secondary">
          {feeLoading ? "Menghitung biaya…" : "Biaya dihitung otomatis dari nilai transaksi."}
        </Text>
      )}
    </FormSection>
  )
}

export function VoucherSection({
  initialCode,
  applied,
  onApply,
  onRemove,
  applying,
  errorText,
}: {
  initialCode?: string
  applied?: AppliedVoucher
  onApply: (code: string) => void
  onRemove: () => void
  applying: boolean
  errorText?: string
}) {
  return (
    <FormSection title="Voucher" divider>
      <VoucherRedeemBox
        initialCode={initialCode}
        applied={applied}
        onApply={onApply}
        onRemove={onRemove}
        applying={applying}
        errorText={errorText}
      />
    </FormSection>
  )
}

export function OrderSummarySection({
  mode,
  role,
  counterpart,
  counterpartName,
  title,
  orderType,
  orderValue,
  deadlineDays,
  feeResponsibility,
  voucherCode,
}: {
  mode: "direct" | "link"
  role: OrderRoleValue
  counterpart: string
  counterpartName?: string | null
  title: string
  orderType: OrderType
  orderValue: number
  deadlineDays: number
  feeResponsibility: "BUYER" | "SELLER" | "SPLIT"
  voucherCode?: string
}) {
  return (
    <FormSection title="Ringkasan" divider>
      <KeyValueList>
        <KeyValue label="Cara membuat" value={mode === "link" ? "Order Link" : "Lawan tertentu"} />
        <KeyValue label="Peran Anda" value={ORDER_ROLE_LABELS[role]} />
        {counterpart.trim() ? (
          <KeyValue label="Lawan" value={counterpartName ?? counterpart.trim()} />
        ) : null}
        <KeyValue label="Judul" value={title.trim()} />
        <KeyValue label="Jenis" value={ORDER_TYPE_LABELS[orderType]} />
        <KeyValue label="Nilai transaksi" value={formatRupiah(orderValue)} />
        <KeyValue label="Tenggat" value={`${deadlineDays} hari`} />
        <KeyValue
          label="Pembayar biaya"
          value={FEE_RESPONSIBILITY_LABELS[feeResponsibility]}
        />
        {voucherCode ? <KeyValue label="Voucher" value={voucherCode} /> : null}
      </KeyValueList>
    </FormSection>
  )
}

export function FeeScheduleSheet({
  visible,
  onRequestClose,
  scheduleLoading,
  schedule,
}: {
  visible: boolean
  onRequestClose: () => void
  scheduleLoading: boolean
  schedule: FeeSchedule | null
}) {
  return (
    <BottomSheet
      avoidKeyboard
      visible={visible}
      onRequestClose={onRequestClose}
      title="Skema biaya platform"
      description="Biaya dihitung dari nilai transaksi menurut tingkatan berikut. Angka pasti untuk order ini tampil di rincian biaya."
    >
      {scheduleLoading ? (
        <Text variant="body" tone="secondary">
          Memuat skema biaya…
        </Text>
      ) : !schedule || schedule.tiers.length === 0 ? (
        <Text variant="body" tone="secondary">
          Skema biaya belum tersedia. Rincian biaya tetap dihitung otomatis saat nilai transaksi
          diisi.
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
              value={
                [
                  t.feePercent != null ? `${formatDecimal(t.feePercent, 2)}%` : null,
                  t.feeFlat != null ? formatRupiah(t.feeFlat) : null,
                ]
                  .filter(Boolean)
                  .join(" + ") || "—"
              }
            />
          ))}
          {schedule.minFee != null ? (
            <KeyValue label="Biaya minimum" value={formatRupiah(schedule.minFee)} />
          ) : null}
          {schedule.maxFee != null ? (
            <KeyValue label="Biaya maksimum" value={formatRupiah(schedule.maxFee)} />
          ) : null}
        </KeyValueList>
      )}
    </BottomSheet>
  )
}
