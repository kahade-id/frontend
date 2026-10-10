/**
 * Screen — Buat Transaksi (order baru) / Buat Order Link — WIZARD 4 LANGKAH.
 *
 * POST /v1/orders/calculate-fee + /validate-counterpart live saat input
 * berubah → POST /v1/orders (mode "Lawan tertentu") atau POST
 * /v1/orders/links (mode "Order Link", tanpa lawan) pada submit. Fee
 * di-refresh paralel dengan validasi counterpart (debounce 400ms).
 *
 * Langkah (seperti Register — H1 + progres di header, satu fokus per layar):
 *   1. Cara & peran   : SegmentedControl mode + OrderRoleSelector
 *   2. Lawan transaksi: username + CounterpartValidationCard
 *   3. Rincian pesanan : judul, deskripsi, jenis, nilai, tenggat
 *   4. Biaya & kirim  : pembayar biaya, skema, rincian, voucher, ringkasan
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
 *   - Poin 2 (2026-10-04): query `jastipParticipantId` /
 *     `patunganParticipantId` menandai order ini membayar partisipasi
 *     jastip/patungan — setelah order terbentuk, order OTOMATIS didaftarkan
 *     ke participant (POST .../create-order); user tidak menempel ID apa
 *     pun. Gagal pendaftaran = order tetap sah + toast peringatan eksplisit.
 *   - Tombol "Lanjut" dijaga validitas langkah AKTIF saja (bukan `canSubmit`
 *     global): pengguna tidak boleh dipaksa melengkapi langkah 4 untuk
 *     sekadar pindah dari langkah 1. Submit akhir tetap memakai `canSubmit`
 *     penuh (fee terkonfirmasi + lawan tervalidasi).
 *   - `key={step}` pada <PullToRefresh>: pindah langkah me-remount scroller
 *     sehingga tiap langkah selalu mulai dari atas — tanpa itu pengguna
 *     mendarat di tengah langkah baru dengan posisi scroll warisan.
 *   - Back header di langkah > 1 kembali ke langkah sebelumnya (bukan keluar
 *     form): keluar tak sengaja membuang seluruh draf yang sudah diketik.
 */

import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { AMOUNT_LIMITS, isValidAmount } from "@/lib/financial"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useNavigation, usePreventRemove, type NavigationAction } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  api,
  isApiError,
  createIdempotencyKey,
  userMessage,
  type CreateOrderDto,
  type CreateOrderLinkDto,
} from "@/lib/api"
import type { FeeSchedule } from "@/lib/api/public"
import { createTrailingDebounce } from "@/lib/debounce"
import { formatDateTimeWIB } from "@/lib/format"
import {
  clearTransactionDraft,
  isMeaningfulTransactionDraft,
  loadTransactionDraft,
  saveTransactionDraft,
  shouldOfferTransactionDraftRestore,
  transactionDraftDeadline,
  transactionDraftFingerprint,
  transactionDraftStep,
  type TransactionDraft,
} from "@/lib/transaction-draft"
import { fetchViaQueryCache } from "@/lib/query-cache"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  type CounterpartState,
} from "@/components/ui/counterpart-validation-card"
import { addDays, normalizePickerDate } from "@/components/ui/date-picker-sheet"
import { DateField } from "@/components/ui/date-field"
import { FadeIn } from "@/components/ui/fade-in"
import { Field } from "@/components/ui/field"
import { PressableScale } from "@/components/ui/pressable-scale"
import { cn } from "@/lib/cn"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/modal"
import {
  OrderTypeSelector,
  ORDER_TYPE_LABELS,
  type OrderRoleValue,
  type OrderType,
} from "@/components/ui/order-form-selectors"
import {
  CounterpartStep,
  FeeScheduleSheet,
  FeeServiceSection,
  OrderSummarySection,
  ShippingAddressSummaryCard,
  VoucherSection,
} from "@/components/create-transaction-review"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import type { AppliedVoucher } from "@/components/ui/voucher-redeem-box"
import { voucherKindOf } from "@/lib/api/vouchers"
import { AddressPicker } from "@/components/ui/address-picker"
import type { Address } from "@/lib/api/commerce"
import { addressLabelText } from "@/lib/api/commerce"
import { addressMissingFields } from "@/lib/wallet-batch139"
import { translate } from "@/lib/i18n/translate"
import {
  ORDER_CATEGORY_LABELS,
  ORDER_CATEGORY_DESCRIPTIONS,
  FULFILLMENT_LABELS,
  PARTICIPANT_MODE_LABELS,
  type OrderCategory,
  type FulfillmentType,
  type ParticipantMode,
} from "@/lib/transaction"
import { showMutationError } from "@/lib/mutation-toast"

const DEBOUNCE_MS = 400

/**
 * Audit voucher 2026-10-10 (F13): pesan spesifik saat `calculate-fee`
 * menolak VOUCHER (bukan nilai order-nya). Backend (B09) kini mengirim kode
 * yang sama dengan create order: VOUCHER_NOT_FOUND / VOUCHER_EXPIRED /
 * VOUCHER_USAGE_LIMIT_REACHED / VOUCHER_NOT_APPLICABLE. `undefined` = bukan
 * penolakan voucher → biarkan jalur error biaya biasa.
 */
function voucherRejectionMessage(error: unknown): string | undefined {
  if (!isApiError(error)) return undefined
  const code = error.backendCode?.toUpperCase()
  if (!code || !code.startsWith("VOUCHER_")) return undefined
  switch (code) {
    case "VOUCHER_NOT_FOUND":
      return translate("Voucher tidak ditemukan — dilepas dari transaksi.")
    case "VOUCHER_EXPIRED":
      return translate("Voucher sudah kedaluwarsa atau nonaktif — dilepas dari transaksi.")
    case "VOUCHER_USAGE_LIMIT_REACHED":
      return translate("Kuota voucher sudah habis — dilepas dari transaksi.")
    default:
      return translate("Voucher tidak berlaku untuk nilai transaksi ini — dilepas. Periksa minimum transaksinya.")
  }
}
/** P1-3 (audit perf/UX 2026-10-03): autosave draft form — satu penulisan per detik. */
const DRAFT_SAVE_DEBOUNCE_MS = 1000
const MIN_ORDER_VALUE = AMOUNT_LIMITS.order.minimum
const MAX_ORDER_VALUE = AMOUNT_LIMITS.order.maximum
const MIN_TITLE = API_CONSTRAINTS.CreateOrderDto.title.minLength
const MIN_DESCRIPTION = API_CONSTRAINTS.CreateOrderDto.description.minLength
const MIN_USERNAME = API_CONSTRAINTS.CreateOrderDto.counterpartUsername.minLength
const MAX_DEADLINE_DAYS = API_CONSTRAINTS.CreateOrderDto.deliveryDeadlineDays.maximum

type Mode = "direct" | "link"

/**
 * Unified v2 (2026-10-06): alur 5 langkah.
 * 1. Kategori (Fisik/Digital/Jasa) — TANPA "Lainnya".
 * 2. Sistem (Langsung/Preorder; Jasa pakai tanggal).
 * 3. Peserta (Sendiri/Patungan).
 * 4. Detail (mitra + rincian kategori).
 * 5. Ringkasan (biaya eksplisit + konfirmasi).
 */

/**
 * Unified v2: pemilih kategori (3 opsi, tanpa "Lainnya").
 */
function CategoryStep({
  value,
  onChange,
}: {
  value: OrderCategory | null
  onChange: (v: OrderCategory) => void
}) {
  const options: Array<{ value: OrderCategory; label: string; description: string }> = (
    ["FISIK", "DIGITAL", "JASA"] as const
  ).map((c) => ({
    value: c,
    label: ORDER_CATEGORY_LABELS[c],
    description: ORDER_CATEGORY_DESCRIPTIONS[c],
  }))
  return (
    <View className="gap-3">
      {options.map((opt) => (
        <PressableScale
          key={opt.value}
          onPress={() => onChange(opt.value)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === opt.value }}
          accessibilityLabel={opt.label}
        >
          <View
            className={cn(
              "rounded-2xl border p-4",
              value === opt.value ? "border-primary bg-primary-soft" : "border-border bg-surface",
            )}
          >
            <Text variant="body" weight={700}>
              {opt.label}
            </Text>
            <Text variant="caption" tone="secondary">
              {opt.description}
            </Text>
          </View>
        </PressableScale>
      ))}
    </View>
  )
}

/**
 * Format Date → "YYYY-MM-DD" untuk payload API.
 */
function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Unified v2: pemilih sistem (Langsung/Preorder; Jasa pakai tanggal).
 */
function SystemStep({
  category,
  fulfillment,
  onFulfillmentChange,
  preorderDate,
  onPreorderDateChange,
  scheduledDate,
  onScheduledDateChange,
}: {
  category: OrderCategory
  fulfillment: FulfillmentType
  onFulfillmentChange: (v: FulfillmentType) => void
  preorderDate: Date | null
  onPreorderDateChange: (v: Date | null) => void
  scheduledDate: Date | null
  onScheduledDateChange: (v: Date | null) => void
}) {
  // Hitung besok sekali per render (ganti addDays untuk hindari dependensi fungsi eksternal)
  const tomorrow = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  })()

  if (category === "JASA") {
    return (
      <View className="gap-3">
        <Text variant="body" tone="secondary">
          Pilih tanggal pelaksanaan jasa.
        </Text>
        <DateField
          label="Tanggal jasa"
          required
          value={scheduledDate}
          onChange={onScheduledDateChange}
          placeholder="Pilih tanggal"
          minDate={tomorrow}
        />
      </View>
    )
  }
  return (
    <View className="gap-3">
      {(["BIASA", "PREORDER"] as const).map((f) => (
        <PressableScale
          key={f}
          onPress={() => onFulfillmentChange(f)}
          accessibilityRole="radio"
          accessibilityState={{ checked: fulfillment === f }}
          accessibilityLabel={FULFILLMENT_LABELS[f]}
        >
          <View
            className={cn(
              "rounded-2xl border p-4",
              fulfillment === f ? "border-primary bg-primary-soft" : "border-border bg-surface",
            )}
          >
            <Text variant="body" weight={700}>
              {FULFILLMENT_LABELS[f]}
            </Text>
            <Text variant="caption" tone="secondary">
              {f === "BIASA" ? "Barang ready, langsung diproses" : "Barang belum ready, estimasi tanggal"}
            </Text>
          </View>
        </PressableScale>
      ))}
      {fulfillment === "PREORDER" ? (
        <DateField
          label="Estimasi tanggal ready"
          required
          value={preorderDate}
          onChange={onPreorderDateChange}
          placeholder="Pilih tanggal"
          minDate={tomorrow}
        />
      ) : null}
    </View>
  )
}

/**
 * Unified v2: pemilih peserta (Sendiri/Patungan).
 */
function ParticipantStep({
  mode,
  onModeChange,
  counterpartNode,
}: {
  mode: ParticipantMode
  onModeChange: (v: ParticipantMode) => void
  // P2-7: props patungan (total, target, deadline, inviteMethod) dihapus —
  // mode GROUP diblokir sementara, tidak ada input patungan.
  /** Node pemilihan mitra (untuk mode SINGLE). */
  counterpartNode?: React.ReactNode
}) {
  return (
    <View className="gap-3">
      {(["SINGLE", "GROUP"] as const).map((m) => (
        <PressableScale
          key={m}
          onPress={() => onModeChange(m)}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === m }}
          accessibilityLabel={PARTICIPANT_MODE_LABELS[m]}
        >
          <View
            className={cn(
              "rounded-2xl border p-4",
              mode === m ? "border-primary bg-primary-soft" : "border-border bg-surface",
            )}
          >
            <Text variant="body" weight={700}>
              {PARTICIPANT_MODE_LABELS[m]}
            </Text>
            <Text variant="caption" tone="secondary">
              {m === "SINGLE" ? "Transaksi 1 lawan 1" : "Urunan 2-100 orang (split bill)"}
            </Text>
          </View>
        </PressableScale>
      ))}
      {mode === "SINGLE" && counterpartNode ? (
        <View className="pt-2">{counterpartNode}</View>
      ) : null}
      {mode === "GROUP" ? (
        <View className="gap-3 pt-2">
          {/* P2-7: Mode patungan diblokir sementara — backend belum punya kontrak grup yang nyata.
              Jangan biarkan user masuk ke alur yang tidak berfungsi. */}
          <View className="rounded-xl border border-warning bg-warning-soft p-4">
            <Text variant="body" weight={700}>
              Patungan segera hadir
            </Text>
            <Text variant="caption" tone="secondary">
              Fitur urunan 2-100 orang sedang disiapkan. Untuk saat ini, silakan gunakan mode Sendiri (1 lawan 1).
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const STEPS = [
  {
    title: "Kategori",
    heading: translate("Apa yang ditransaksikan?"),
    description: translate("Pilih kategori — menentukan informasi yang perlu dilengkapi."),
  },
  {
    title: translate("Sistem"),
    heading: translate("Bagaimana sistemnya?"),
    description: translate("Langsung atau preorder. Jasa memakai tanggal jadwal."),
  },
  {
    title: translate("Peserta"),
    heading: translate("Siapa yang ikut?"),
    description: translate("Sendiri atau patungan bersama."),
  },
  {
    title: translate("Detail"),
    heading: translate("Rincian transaksi"),
    description: translate("Lengkapi detail dan mitra transaksi."),
  },
  {
    title: translate("Ringkasan"),
    heading: translate("Periksa & buat"),
    description: translate("Periksa ringkasan dan biaya sebelum transaksi dibuat."),
  },
] as const
const LAST_STEP = STEPS.length - 1

/**
 * Terjemahan pesan KYC_REQUIRED backend → penjelasan Indonesia yang bisa
 * dipahamkan ke pengguna. Ditebak dari frasa kunci pesan backend (bahasa
 * Inggris): "Cumulative active orders…" / "Rolling 30-day…" / sisanya =
 * aturan transaksi tunggal ≥ Rp 2jt.
 */
function kycReasonMessage(backendMessage: string): string {
  // R2 (audit ronde-2, butir #62): DETEKSI dialog KYC sudah berbasis kode
  // mesin (`err.backendCode === "KYC_REQUIRED"` di catch submit) — regex di
  // sini HANYA memilih wording penjelasan. Copy server yang berubah/memakai
  // bahasa lain jatuh ke pesan generik yang AMAN (bukan false-positive/negatif).
  if (/cumulative/i.test(backendMessage)) {
    return translate(
      "Total nilai transaksi aktif Anda (ditambah transaksi ini) mencapai batas Rp2.000.000. Selesaikan verifikasi identitas (KYC) untuk melanjutkan membuat transaksi.",
    )
  }
  if (/rolling/i.test(backendMessage)) {
    return translate(
      "Total transaksi 30 hari terakhir Anda mencapai batas. Selesaikan verifikasi identitas (KYC) untuk melanjutkan membuat transaksi.",
    )
  }
  return translate("Transaksi dengan nilai Rp2.000.000 ke atas membutuhkan verifikasi identitas (KYC).")
}

/** Bentuk prefill dari query params (ROUTES.createTransactionFromTemplate). */
type TemplatePrefill = {
  role?: "BUYER" | "SELLER"
  title?: string
  orderType?: OrderType
  amount?: number
  deadline?: number
  fee?: "BUYER" | "SELLER" | "SPLIT"
  description?: string
}

export default function CreateTransactionScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  // `step` diinisialisasi SETELAH templatePrefill di bawah (U5-006).
  // `counterpart` dari query (ROUTES.createTransactionWith /
  // createTransactionFromTemplate) — profil publik / template mengisi lawan
  // transaksi lebih dulu; validasi tetap jalan via debounce.
  const params = useLocalSearchParams<{
    counterpart?: string
    voucherCode?: string
    /** Prefill dari template (ROUTES.createTransactionFromTemplate). */
    role?: string
    title?: string
    orderType?: string
    amount?: string
    deadline?: string
    fee?: string
    description?: string
    /** U5-006 (journey): "1" = dibuka dari tombol Beli Etalase. */
    fromShowcase?: string
    /** Batch 43 (item 10): slot jasa dari detail etalase — di-booking saat submit. */
    slotId?: string
    slotDate?: string
    slotTime?: string
    /** "1" = slot sudah di-booking di halaman detail — jangan booking ulang. */
    slotBooked?: string
    /**
     * Poin 2 (2026-10-04): partisipasi jastip/patungan yang dibayar order
     * ini — setelah order terbentuk, otomatis didaftarkan via
     * POST /v1/jastip|patungan/participants/:id/create-order (tanpa tempel
     * ID manual). Diteruskan ROUTES.createTransactionJastip/Patungan.
     */
    jastipParticipantId?: string
    patunganParticipantId?: string
  }>()
  // Batch 43 (item 10): prefill slot jasa — sekali saat mount.
  const slotPrefill = useMemo(() => {
    const slotId = params.slotId?.trim() || undefined
    if (!slotId) return null
    return {
      slotId,
      slotDate: params.slotDate?.trim() || undefined,
      slotTime: params.slotTime?.trim() || undefined,
      alreadyBooked: params.slotBooked === "1",
    }
  }, [params.slotId, params.slotDate, params.slotTime, params.slotBooked])
  /**
   * Poin 2 (2026-10-04): partisipasi jastip/patungan yang dibayar order ini
   * (dari ROUTES.createTransactionJastip/Patungan) — sekali saat mount.
   * Satu order hanya membayar satu partisipasi; bila (mustahil) keduanya
   * terisi, jastip diprioritaskan.
   */
  const participantPrefill = useMemo(() => {
    const jastipParticipantId = params.jastipParticipantId?.trim() || undefined
    const patunganParticipantId = params.patunganParticipantId?.trim() || undefined
    if (jastipParticipantId) return { kind: "jastip" as const, id: jastipParticipantId }
    if (patunganParticipantId) return { kind: "patungan" as const, id: patunganParticipantId }
    return null
  }, [params.jastipParticipantId, params.patunganParticipantId])
  const [mode, setMode] = useState<Mode>("direct")
  /**
   * Unified v2 (2026-10-06): state 3-dimensi.
   */
  const [category, setCategory] = useState<OrderCategory | null>(null)
  // Sinkronkan orderType lama dengan kategori baru (untuk kompatibilitas).
  useEffect(() => {
    if (category === "FISIK") setOrderType("PHYSICAL_GOODS")
    else if (category === "DIGITAL") setOrderType("DIGITAL_GOODS")
    else if (category === "JASA") setOrderType("SERVICE")
  }, [category])
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("BIASA")
  const [preorderDate, setPreorderDate] = useState<Date | null>(null)
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null)
  const [participantMode, setParticipantMode] = useState<ParticipantMode>("SINGLE")
  // P2-7: state patungan dihapus — mode GROUP diblokir sementara.
  // Detail kategori (v1): kondisi barang fisik, metode digital, deliverable jasa.
  // Alamat pengiriman pakai state existing (address book).
  const [itemCondition, setItemCondition] = useState<"baru" | "bekas">("baru")
  const [conditionDesc, setConditionDesc] = useState("")
  const [deliveryMethod, setDeliveryMethod] = useState<"file" | "kode" | "akun" | "lainnya">("file")
  const [warrantyDays, setWarrantyDays] = useState("7")
  const [deliverables, setDeliverables] = useState("")
  const [serviceLocation, setServiceLocation] = useState("")
  const [cancellationPolicy, setCancellationPolicy] = useState("")
  // Nilai prefill template dibersihkan SATU KALI di sini (bukan di initializer
  // state): parameter query tidak berubah saat layar hidup, jadi hasilnya
  // stabil dan bisa dipakai beberapa state di bawah. Tipe dikembalikan
  // eksplisit karena inferensi useMemo melebarkan literal string jadi `string`.
  const templatePrefill = useMemo<TemplatePrefill>(() => {
    const amount = Number.parseInt(params.amount ?? "", 10)
    const deadline = Number.parseInt(params.deadline ?? "", 10)
    // Ternary per nilai literal (bukan `x === A || x === B ? x : undefined`):
    // property query params tidak men-narrow lewat kondisi majemuk, jadi
    // bentuknya dikembalikan sebagai literal eksplisit.
    return {
      role: params.role === "SELLER" ? "SELLER" : params.role === "BUYER" ? "BUYER" : undefined,
      title: params.title?.trim() || undefined,
      orderType:
        params.orderType === "PHYSICAL_GOODS"
          ? "PHYSICAL_GOODS"
          : params.orderType === "DIGITAL_GOODS"
            ? "DIGITAL_GOODS"
            : params.orderType === "SERVICE"
              ? "SERVICE"
              : params.orderType === "OTHER"
                ? "OTHER"
                : undefined,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      deadline:
        Number.isFinite(deadline) && deadline >= 1 ? Math.min(MAX_DEADLINE_DAYS, deadline) : undefined,
      fee:
        params.fee === "BUYER"
          ? "BUYER"
          : params.fee === "SELLER"
            ? "SELLER"
            : params.fee === "SPLIT"
              ? "SPLIT"
              : undefined,
      description: params.description?.trim() || undefined,
    }
  }, [params.amount, params.title, params.orderType, params.deadline, params.fee, params.description, params.role])
  /**
   * U5-006 (journey): "Beli" dari Etalase (`fromShowcase=1`). Bila prefill
   * lengkap & valid — peran BUYER, lawan terisi, judul & nominal valid —
   * wizard langsung dibuka di langkah "Detail" (2): "Cara & peran" dan
   * "Lawan" sudah terjawab oleh konteks karya. Field yang TIDAK dibawa
   * kontrak showcase (tipe order, deadline, pembagi biaya) tetap diisi
   * manual di sini — tidak dikarang. Bila prefill tidak lengkap → mulai
   * dari langkah 0 seperti biasa (fail-closed). Validasi lawan tetap
   * berjalan di latar dan MENGUNCI submit (`counterpartConfirmed`).
   */
  const showcasePrefillComplete =
    params.fromShowcase === "1" &&
    templatePrefill.role === "BUYER" &&
    (params.counterpart?.trim().length ?? 0) >= MIN_USERNAME &&
    (templatePrefill.title?.length ?? 0) > 0 &&
    (templatePrefill.amount ?? 0) > 0
  /**
   * FE-044: etalase TANPA orderLink (hanya counterpart + role=BUYER dari
   * tombol "Beli via Kahade") — prefill tidak lengkap, tapi "Cara & peran"
   * sudah terjawab konteks karya (direct + BUYER). Mulai dari langkah
   * "Mitra transaksi" (1), bukan "Cara & peran" (0). Tipe order/deadline/fee TIDAK
   * dikarang — tetap diisi manual di langkah Detail.
   */
  const showcasePrefillPartial =
    !showcasePrefillComplete &&
    params.fromShowcase === "1" &&
    templatePrefill.role === "BUYER" &&
    (params.counterpart?.trim().length ?? 0) >= MIN_USERNAME
  const [step, setStep] = useState(showcasePrefillComplete ? 2 : showcasePrefillPartial ? 1 : 0)
  const [role, setRole] = useState<OrderRoleValue>(templatePrefill.role ?? "BUYER")
  const [counterpart, setCounterpart] = useState(params.counterpart?.trim() ?? "")
  const [counterpartState, setCounterpartState] = useState<CounterpartState>("loading")
  const [counterpartName, setCounterpartName] = useState<string | undefined>()
  const [counterpartUsername, setCounterpartUsername] = useState<string | undefined>()
  const [counterpartVerified, setCounterpartVerified] = useState(false)
  const [counterpartWarnings, setCounterpartWarnings] = useState<string[]>([])
  /** Alasan spesifik dari backend untuk state `blocked` (bukan "tidak ditemukan"). */
  const [counterpartReason, setCounterpartReason] = useState<string | undefined>()
  const [title, setTitle] = useState(templatePrefill.title ?? "")
  const [description, setDescription] = useState(templatePrefill.description ?? "")
  const [orderType, setOrderType] = useState<OrderType>(
    // Batch 43: slot jasa dari detail etalase memaksa tipe SERVICE.
    slotPrefill ? "SERVICE" : (templatePrefill.orderType ?? "SERVICE"),
  )
  const [orderValue, setOrderValue] = useState(templatePrefill.amount ?? 0)
  // F10 (audit 2026-09-26): tenggat dipilih lewat kalender <DatePickerSheet>,
  // BUKAN input angka hari. `null` = belum dipilih → placeholder "Pilih
  // tanggal", validasi menahan "Lanjut". TIDAK ada auto-fill diam-diam ke
  // "1" seperti perilaku onBlur input angka sebelumnya.
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(() =>
    templatePrefill.deadline != null ? addDays(new Date(), templatePrefill.deadline) : null,
  )
  // Sheet pernah dibuka-tutup tanpa memilih tanggal → error "pilih tanggal"
  // boleh tampil (user tahu kenapa "Lanjut" tertahan).
  const [deadlineTouched, setDeadlineTouched] = useState(false)
  const [feeResponsibility, setFeeResponsibility] = useState<"BUYER" | "SELLER" | "SPLIT">(
    templatePrefill.fee ?? "SPLIT",
  )
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
      // PERF-FIX (network P2): jadwal biaya nyaris-statis — lewat query
      // cache kanonik `fee-schedule` (TTL 60 dtk), bukan fetch mentah per
      // mount. Guard state lokal tetap mencegah fetch ganda dalam satu mount.
      setSchedule(await fetchViaQueryCache("fee-schedule", (signal) => api.public.getFeeSchedule(signal)))
    } catch {
      setSchedule(null)
    } finally {
      setScheduleLoading(false)
    }
  }, [schedule, scheduleLoading])
  const [voucher, setVoucher] = useState<AppliedVoucher | null>(null)
  const [applyingVoucher, setApplyingVoucher] = useState(false)
  // TRX-009: alamat pengiriman terpilih — WAJIB untuk FISIK, dikirim sebagai
  // `shippingAddressId` (backend fail-closed untuk PHYSICAL_GOODS).
  const [shippingAddress, setShippingAddress] = useState<Address | null>(null)
  const [voucherError, setVoucherError] = useState<string | undefined>()
  // Batch 43 (item 9): voucher toko penjual — validasi via
  // POST /v1/seller-vouchers/validate (butuh sellerId). Saling eksklusif
  // dengan voucher platform: hanya satu kode yang dikirim sebagai
  // `voucherCode` (server me-resolve dari tabel voucher yang sama).
  const [sellerVoucher, setSellerVoucher] = useState<AppliedVoucher | null>(null)
  const [applyingSellerVoucher, setApplyingSellerVoucher] = useState(false)
  const [sellerVoucherError, setSellerVoucherError] = useState<string | undefined>()
  const [counterpartUserId, setCounterpartUserId] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  /** Kode voucher efektif (satu-satunya yang dikirim ke server). */
  const effectiveVoucherCode = sellerVoucher?.code ?? voucher?.code
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  /**
   * Backend menolak dengan KYC_REQUIRED (403). Pesan asli berbahasa Inggris
   * dan teknis — diturunkan ke dialog bahasa Indonesia + CTA layar KYC.
   * Aturan backend: transaksi TUNGGAL ≥ Rp 2jt perlu KYC; ATAU total transaksi
   * aktif mencapai Rp 2jt (anti-structuring); ATAU rolling 30 hari ≥ Rp 6jt.
   * Transaksi kecil pada akun tanpa transaksi aktif tidak terblokir.
   */
  const [kycReason, setKycReason] = useState<string | null>(null)
  const submitLock = useRef(false)
  /**
   * M-08 (audit end-to-end, issue #1/#4/#102): satu `Idempotency-Key` per
   * SIKLUS submit — ditahan saat kegagalan tak pasti (order/link MUNGKIN sudah
   * terbuat), di-reset setelah sukses/gagal pasti. Dulu `createOrder(dto)`
   * tanpa kunci → PARSE/timeout setelah order terbentuk + submit ulang =
   * order GANDA.
   */
  const submitKeyRef = useRef<string | null>(null)
  const feeKey = JSON.stringify([orderValue, feeResponsibility, role, effectiveVoucherCode, voucher?.discount, sellerVoucher?.discount])
  const draft = useRef({ feeKey, counterpart: counterpart.trim() })
  draft.current = { feeKey, counterpart: counterpart.trim() }
  const [confirmedFeeKey, setConfirmedFeeKey] = useState<string | null>(null)
  const [confirmedCounterpart, setConfirmedCounterpart] = useState<string | null>(null)
  const [feeError, setFeeError] = useState<string | null>(null)

  /**
   * NAV-012: Back / gesture-back / tab tidak boleh menghapus isian diam-diam.
   * `dirty` = ada ketikan/pilihan yang menyimpang dari nilai awal (prefill
   * template ikut dihitung — kembali tanpa konfirmasi membuang konteks).
   */
  const navigation = useNavigation()
  const [initialDeadlineTime] = useState<number | null>(() => deadlineDate?.getTime() ?? null)
  const dirty =
    step > 0 ||
    counterpart.trim() !== (params.counterpart?.trim() ?? "") ||
    title.trim() !== (templatePrefill.title ?? "").trim() ||
    description.trim() !== (templatePrefill.description ?? "").trim() ||
    orderValue !== (templatePrefill.amount ?? 0) ||
    (deadlineDate?.getTime() ?? null) !== initialDeadlineTime ||
    // F14: voucher yang dipasang OTOMATIS dari param bukan ketikan user —
    // tidak boleh memicu konfirmasi "Buang?" saat kembali.
    (voucher != null && voucher.code !== params.voucherCode?.trim().toUpperCase()) ||
    sellerVoucher != null ||
    shippingAddress != null
  /**
   * Keluar yang disengaja (konfirmasi "Buang" / submit sukses): `beforeRemove`
   * membaca flag `preventRemove` dari render TERAKHIR, jadi navigasi tidak
   * boleh dieksekusi di handler yang sama dengan `setIntentionalLeave(true)` —
   * selalu lewat effect di bawah setelah guard mati.
   * (Pola yang sama dengan app/showcase/create.tsx.)
   */
  const [intentionalLeave, setIntentionalLeave] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  /**
   * P1-3 (audit perf/UX 2026-10-03): draft lokal form "Buat Transaksi".
   *
   * Isian wizard ini mahal — lawan tervalidasi, rincian pesanan, nominal,
   * tenggat — dan dulu hilang TOTAL begitu layar ter-unmount: app dibunuh OS
   * saat di background, tap notifikasi, atau pindah layar sejenak untuk
   * menyalin kode voucher. Sekarang isian ditulis ke SecureStore dengan
   * debounce 1 detik, dan pemulihannya SELALU ditanyakan ke pengguna.
   *
   * Keputusan non-obvious:
   *   - Debounce memakai `createTrailingDebounce` (bukan setTimeout di effect)
   *     supaya penulisan yang tertunda bisa DISIRAM saat layar unmount —
   *     justru skenario yang diperbaiki temuan ini (ketik lalu langsung
   *     keluar < 1 detik).
   *   - Prefill template/etalase yang belum disentuh pengguna BUKAN draft:
   *     sidik jari keadaan awal dibandingkan dulu, jika tidak setiap kali
   *     membuka form dari template akan lahir draft yang mengganggu.
   *   - Draft TIDAK dipulihkan otomatis: nominal & lawan transaksi bisa basi,
   *     jadi keputusan ada di pengguna (Dialog di bawah).
   */
  const [draftOffer, setDraftOffer] = useState<TransactionDraft | null>(null)
  const draftRestoreChecked = useRef(false)
  const draftPayload = useMemo(
    () => ({
      mode,
      role,
      counterpart,
      title,
      description,
      orderType,
      orderValue,
      deadlineIso: deadlineDate ? deadlineDate.toISOString() : null,
      feeResponsibility,
    }),
    [
      mode,
      role,
      counterpart,
      title,
      description,
      orderType,
      orderValue,
      deadlineDate,
      feeResponsibility,
    ],
  )
  const initialDraftFingerprint = useRef<string | null>(null)
  if (initialDraftFingerprint.current === null) {
    initialDraftFingerprint.current = transactionDraftFingerprint(draftPayload)
  }
  const draftSaver = useRef<ReturnType<
    typeof createTrailingDebounce<Omit<TransactionDraft, "savedAt">>
  > | null>(null)
  if (draftSaver.current === null) {
    draftSaver.current = createTrailingDebounce<Omit<TransactionDraft, "savedAt">>(
      (payload) => {
        void saveTransactionDraft(payload)
      },
      DRAFT_SAVE_DEBOUNCE_MS,
    )
  }
  /** Flag: draft sudah dibuang/di-commit — jangan disiram saat unmount. */
  const draftAbandoned = useRef(false)

  // Pulihkan: baca draft SEKALI saat mount, lalu tawarkan bila masih layak.
  useEffect(() => {
    if (draftRestoreChecked.current) return
    draftRestoreChecked.current = true
    let alive = true
    void loadTransactionDraft().then((saved) => {
      if (!alive) return
      if (shouldOfferTransactionDraftRestore(saved)) setDraftOffer(saved)
    })
    return () => {
      alive = false
    }
  }, [])

  // Autosave: satu penulisan per detik, hanya untuk isian pengguna.
  useEffect(() => {
    if (draftAbandoned.current || submitting || intentionalLeave) return
    if (!isMeaningfulTransactionDraft({ ...draftPayload, savedAt: "" })) return
    if (transactionDraftFingerprint(draftPayload) === initialDraftFingerprint.current) return
    draftSaver.current?.call(draftPayload)
  }, [draftPayload, submitting, intentionalLeave])

  // Siram penulisan yang tertunda saat layar unmount — inilah kasus yang
  // ditemukan audit (ketik 3 field lalu langsung keluar).
  useEffect(() => {
    const saver = draftSaver.current
    return () => {
      if (!draftAbandoned.current) saver?.flush()
    }
  }, [])

  /** Buang draft: subtitel "Mulai baru", konfirmasi "Buang", dan submit sukses. */
  const discardTransactionDraft = useCallback(() => {
    draftAbandoned.current = true
    draftSaver.current?.cancel()
    void clearTransactionDraft()
  }, [])

  const restoreDraft = useCallback((saved: TransactionDraft) => {
    setMode(saved.mode)
    setRole(saved.role)
    setCounterpart(saved.counterpart)
    setTitle(saved.title)
    setDescription(saved.description)
    setOrderType(saved.orderType)
    setOrderValue(saved.orderValue)
    setDeadlineDate(transactionDraftDeadline(saved))
    setFeeResponsibility(saved.feeResponsibility)
    setStep(transactionDraftStep(saved))
    // Draft yang dipulihkan ≠ prefill: tandai longgar agar autosave berikutnya
    // (mis. pengguna hanya menekan Lanjut) tidak dianggap "belum disentuh".
    initialDraftFingerprint.current = null
    setDraftOffer(null)
  }, [])
  const pendingNavigation = useRef<NavigationAction | null>(null)
  const pendingReplace = useRef<Parameters<typeof router.replace>[0] | null>(null)
  // P2-T5: didefinisikan sebelum usePreventRemove agar hardware back bisa
  // memanggilnya (mundur satu langkah, bukan dialog buang form).
  const goPrevEarly = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])

  usePreventRemove(dirty && !intentionalLeave, ({ data }) => {
    if (submitting) return
    // P2-T5: hardware back di step > 0 = mundur satu langkah (seperti tombol
    // back header), bukan dialog buang seluruh form.
    const action = data.action
    const isBack = action?.type === "POP" || action?.type === "GO_BACK"
    if (isBack && step > 0) {
      goPrevEarly()
      return
    }
    pendingNavigation.current = action
    setDiscardOpen(true)
  })

  useEffect(() => {
    if (!intentionalLeave) return
    const action = pendingNavigation.current
    pendingNavigation.current = null
    const replaceHref = pendingReplace.current
    pendingReplace.current = null
    if (action) navigation.dispatch(action)
    else if (replaceHref) router.replace(replaceHref)
    // 2026-10-08 (#17): cabang terakhir ini dulu `router.back()`. Bila rute
    // ini adalah satu-satunya entri stack (dibuka dari tautan langsung),
    // back adalah no-op: pengguna sudah mengonfirmasi "Buang" tetapi tetap
    // terjebak di form. Jatuh ke daftar transaksi.
    else if (router.canGoBack()) router.back()
    else router.replace(ROUTES.transactions)
  }, [intentionalLeave, navigation, router])

  // Web: peringatan bawaan browser sebelum tab ditutup dengan isian hidup.
  useEffect(() => {
    if (typeof window === "undefined" || !dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  // ── Validitas per langkah (gerbang tombol "Lanjut") ──────────────────
  const counterpartConfirmed =
    confirmedCounterpart === counterpart.trim() && counterpartState === "found"
  const counterpartValid = mode === "link" ? !counterpart.trim() || counterpartConfirmed : counterpartConfirmed
  // F3 (audit 2026-09-26): error per-field — tombol "Lanjut" tetap di-disable
  // saat tidak valid, tapi user tahu kenapa (bukan menebak-nebak).
  const titleTrimmed = title.trim()
  const descriptionTrimmed = description.trim()
  const titleError =
    titleTrimmed.length > 0 && titleTrimmed.length < MIN_TITLE
      ? translate("Minimal {x} karakter.", { x: MIN_TITLE })
      : undefined
  const descriptionError =
    descriptionTrimmed.length > 0 && descriptionTrimmed.length < MIN_DESCRIPTION
      ? translate("Minimal {x} karakter.", { x: MIN_DESCRIPTION })
      : undefined
  const deadlineError =
    deadlineTouched && deadlineDate == null
      ? translate("Pilih tanggal tenggat pengiriman terlebih dahulu.")
      : undefined
  // TRX-009: alamat pengiriman WAJIB & LENGKAP untuk barang fisik. Mode link
  // yang dibuat sebagai SELLER dikecualikan — alamat diisi penerima saat
  // accept link (kontrak accept mendukung shippingAddressId).
  const shippingAddressRequired =
    orderType === "PHYSICAL_GOODS" && (mode === "direct" || role === "BUYER")
  const shippingAddressMissing = shippingAddressRequired
    ? addressMissingFields(
        shippingAddress
          ? {
              label: addressLabelText(shippingAddress),
              recipientName: shippingAddress.recipientName,
              phone: shippingAddress.phone,
              addressLine: shippingAddress.addressLine,
              city: shippingAddress.city,
              postalCode: shippingAddress.postalCode,
            }
          : null,
      )
    : []
  const shippingAddressValid = shippingAddressMissing.length === 0
  // P2-8: warrantyDays harus angka >= 0 (tolak negatif).
  const warrantyDaysNum = Number(warrantyDays)
  const warrantyDaysValid =
    category !== "DIGITAL" ||
    (warrantyDays.trim().length > 0 &&
      Number.isFinite(warrantyDaysNum) &&
      Number.isInteger(warrantyDaysNum) &&
      warrantyDaysNum >= 0)
  const detailValid =
    titleTrimmed.length >= MIN_TITLE &&
    descriptionTrimmed.length >= MIN_DESCRIPTION &&
    isValidAmount(orderValue, AMOUNT_LIMITS.order) &&
    deadlineDate != null &&
    warrantyDaysValid &&
    // TRX-009: barang fisik tidak bisa lanjut/submit tanpa alamat lengkap.
    shippingAddressValid
  const feeValid = confirmedFeeKey === feeKey && !feeLoading && !!fee
  // Unified v2: validasi per langkah (5 langkah).
  const categoryValid = category !== null
  const systemValid =
    category === "JASA"
      ? scheduledDate != null
      : fulfillment === "PREORDER"
        ? preorderDate != null
        : true
  // P2-7: Mode GROUP diblokir sementara — selalu tidak valid agar user tidak bisa lanjut.
  const participantValid =
    participantMode === "GROUP" ? false : counterpartValid
  const stepValid = [
    categoryValid,
    systemValid,
    participantValid,
    counterpartValid && detailValid,
    feeValid && counterpartValid && detailValid,
  ]
  const canSubmit =
    detailValid && feeValid && (mode === "link" ? !counterpart.trim() || counterpartConfirmed : counterpartConfirmed)

  const refreshFee = useCallback(async () => {
    if (!isValidAmount(orderValue, AMOUNT_LIMITS.order)) {
      setFee(null)
      return
    }
    const started = feeKey
    setFeeLoading(true)
    setFeeError(null)
    try {
      const res = await api.orders.calculateFee({
        orderValue,
        feeResponsibility,
        voucherCode: effectiveVoucherCode,
        role,
      })
      if (draft.current.feeKey !== started) return
      setFee(res)
      setConfirmedFeeKey(started)
    } catch (error) {
      if (draft.current.feeKey !== started) return
      // Audit voucher 2026-10-10 (F13): nilai order diubah SETELAH voucher
      // terpasang → server menolak voucher (min. order / kuota / kedaluwarsa)
      // dan dulu SELURUH ringkasan biaya error tanpa menyebut voucher. Kini
      // voucher dilepas dengan pesan spesifik; fee dihitung ulang tanpa kode
      // (feeKey berubah → effect refreshFee jalan lagi).
      const voucherReason = effectiveVoucherCode ? voucherRejectionMessage(error) : undefined
      if (voucherReason) {
        if (sellerVoucher) {
          setSellerVoucher(null)
          setSellerVoucherError(voucherReason)
        } else {
          setVoucher(null)
          setVoucherError(voucherReason)
        }
        return
      }
      setFee(null)
      setConfirmedFeeKey(null)
      setFeeError(userMessage(error))
    } finally {
      if (draft.current.feeKey === started) setFeeLoading(false)
    }
  }, [orderValue, feeResponsibility, effectiveVoucherCode, sellerVoucher, role, feeKey])

  const validateCounterpart = useCallback(async () => {
    const q = counterpart.trim()
    if (q.length < MIN_USERNAME) {
      setCounterpartState("loading")
      return
    }
    setCounterpartState("loading")
    try {
      // R2 (audit ronde-2, butir #57): sinyal identitas diri untuk cabang
      // "self" kartu validasi — dulu state itu tak pernah diset sehingga order
      // escrow ke akun sendiri lolos sampai ditolak server.
      const [res, me] = await Promise.all([
        api.orders.validateCounterpart({ username: q }),
        api.users.getMeCached().catch(() => null),
      ])
      // Batch 43 (item 9): simpan ID internal untuk validasi voucher toko.
      setCounterpartUserId(res.user?.id ?? null)
      setMyUserId(me?.id ?? null)
      if (draft.current.counterpart !== q) return
      const isSelf =
        (me?.id != null && res.user?.id != null && me.id === res.user.id) ||
        (me?.username != null &&
          res.user?.username != null &&
          me.username.toLowerCase() === res.user.username.toLowerCase()) ||
        (me?.username != null && me.username.toLowerCase() === q.toLowerCase())
      setConfirmedCounterpart(res.valid && !isSelf ? q : null)
      // `notFound` (user tidak ada) BEDA dari `blocked` (ada tapi tidak boleh
      // transaksi). Sebelum normalizer di lib/api/orders.ts, bentuk respons yang
      // namanya berbeda membuat `res.valid` undefined dan SEMUA lawan transaksi
      // jatuh ke "blocked" — pengguna dituduh memblokir/diblokir padahal tidak.
      // I-02 (audit end-to-end): `unknown` (respons tanpa sinyal apa pun) juga
      // BUKAN vonis — dulu ikut jatuh "blocked"/"notFound" yang menuduh.
      setCounterpartState(
        isSelf
          ? "self"
          : res.valid
            ? "found"
            : res.unknown
              ? "error"
              : res.notFound
                ? "notFound"
                : "blocked",
      )
      setCounterpartReason(res.reason)
      setCounterpartName(res.user?.fullName ?? q)
      setCounterpartUsername(res.user?.username ?? q)
      setCounterpartVerified(res.user?.kycVerified ?? false)
      // KYC lawan transaksi BUKAN syarat transaksi: spec `CreateOrderDto` tidak
      // menyebut KYC sama sekali, dan <CounterpartValidationCard> sengaja
      // merender `warnings` sebagai Badge (transaksi tetap boleh), bukan Alert.
      // Jadi status KYC hanya menjadi peringatan, tidak pernah memblokir.
      setCounterpartWarnings(
        res.valid
          ? res.user && res.user.kycVerified === false
            ? ["Lawan transaksi belum menyelesaikan verifikasi identitas"]
            : []
          : res.reason
            ? [res.reason]
            : [],
      )
    } catch (error) {
      if (draft.current.counterpart !== q) return
      setConfirmedCounterpart(null)
      // I-02 (audit end-to-end): jaringan/timeout/PARSE BUKAN "diblokir".
      // Versi lama menuduh pengguna memblokir/diblokir setiap kali koneksi
      // drop — vonis salah yang membatalkan transaksi. State `error` mengajak
      // mencoba lagi tanpa menyimpulkan apa pun tentang lawan transaksi.
      setCounterpartState("error")
      setCounterpartWarnings([userMessage(error)])
    }
  }, [counterpart])

  useEffect(() => {
    const timer = setTimeout(() => void validateCounterpart(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [validateCounterpart])
  useEffect(() => {
    const timer = setTimeout(() => void refreshFee(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [refreshFee])

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
          setVoucherError(res.message ?? translate("Kode voucher tidak berlaku."))
          return
        }
        const v = res.voucher
        // F10/F11: bonus top-up tidak bisa dipakai di transaksi — tolak di
        // sini dengan pesan jelas, bukan saat create order.
        const kind = voucherKindOf(v?.voucherType)
        if (kind === "TOPUP_BONUS") {
          setVoucherError(translate("Kode ini untuk bonus top-up saldo, bukan untuk transaksi."))
          return
        }
        setVoucher({
          code: v?.code ?? code,
          // Voucher valid tanpa nominal dari server: simpan `undefined`, bukan
          // NaN — NaN merambat ke <Amount> sebagai "Rp—" dan ke perhitungan
          // biaya sebagai angka yang terlihat sah. Voucher PERSEN:
          // `discountValue` adalah persen, bukan Rupiah — nominalnya baru
          // diketahui dari calculate-fee (`fee.discount`).
          discount:
            v?.discountType !== "PERCENT" && Number.isFinite(v?.discountValue) ? v?.discountValue : undefined,
          title: v?.title,
          kind,
        })
        // Saling eksklusif dengan voucher toko (item 9).
        setSellerVoucher(null)
      } catch (err) {
        // M-26 (audit end-to-end, issue #18): "Voucher tidak valid" HANYA untuk
        // penolakan pasti server. PARSE/jaringan = pemeriksaan gagal — voucher
        // bisa saja sah; jangan menghakimi kodenya.
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        setVoucherError(
          uncertain
            ? translate("Gagal memeriksa voucher — periksa koneksi, lalu coba lagi.")
            : translate("Kode voucher tidak berlaku."),
        )
      } finally {
        setApplyingVoucher(false)
      }
    },
    [orderValue, role],
  )

  // Audit voucher 2026-10-10 (F14): kode dari halaman Promo / kartu voucher
  // ("Pakai") dulu hanya mengisi kolom di langkah terakhir — user masih
  // harus menekan "Pakai" lagi. Kini dipasang otomatis SEKALI per kode.
  const autoAppliedVoucherRef = useRef<string | null>(null)
  useEffect(() => {
    const code = params.voucherCode?.trim().toUpperCase()
    if (!code || mode !== "direct" || autoAppliedVoucherRef.current === code) return
    autoAppliedVoucherRef.current = code
    void handleApplyVoucher(code)
    // Hanya saat kode param berubah — handleApplyVoucher berubah tiap
    // orderValue/role, dan itu bukan alasan memasang ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.voucherCode, mode])

  // Batch 43 (item 9): validasi voucher toko penjual. sellerId = lawan bila
  // saya pembeli, atau diri sendiri bila saya penjual. Saling eksklusif
  // dengan voucher platform — yang baru dipasang menggantikan yang lama.
  const sellerIdForVoucher = role === "SELLER" ? myUserId : counterpartUserId
  const handleApplySellerVoucher = useCallback(
    async (code: string) => {
      if (!sellerIdForVoucher) {
        setSellerVoucherError(translate("Penjual belum teridentifikasi — pastikan lawan transaksi valid."))
        return
      }
      setApplyingSellerVoucher(true)
      setSellerVoucherError(undefined)
      try {
        const res = await api.commerce.validateSellerVoucher(code, orderValue, sellerIdForVoucher)
        if (!res.valid) {
          setSellerVoucherError(res.message ?? translate("Kode voucher toko tidak berlaku."))
          return
        }
        setSellerVoucher({
          code: res.code ?? code.toUpperCase(),
          discount: Number.isFinite(res.discountIdr) ? (res.discountIdr as number) : undefined,
          title: res.name ?? undefined,
        })
        setVoucher(null)
      } catch (err) {
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        setSellerVoucherError(
          uncertain
            ? "Gagal memeriksa voucher — periksa koneksi, lalu coba lagi."
            : userMessage(err),
        )
      } finally {
        setApplyingSellerVoucher(false)
      }
    },
    [orderValue, sellerIdForVoucher],
  )

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitLock.current) return
    // Dijaga `canSubmit` (detailValid menuntut deadlineDate != null); pengaman
    // TS karena narrowing tidak menembus closure `canSubmit`.
    if (deadlineDate == null) return
    submitLock.current = true
    setSubmitting(true)
    try {
      // P0-4 (audit integrasi 2026-10-06): `book-with-order` backend langsung
      // membuat escrow order (endpoint `/book` lama 410 Gone). Bila slot
      // belum di-booking, booking di sini SEKALIGUS membuat order — jangan
      // lanjutkan ke `createOrder` di bawah (duplikat). Arahkan ke order
      // yang baru dibuat. Slot yang sudah di-booking di halaman detail
      // (`slotBooked: "1"`) tetap memakai jalur `createOrder` biasa di bawah.
      if (slotPrefill && !slotPrefill.alreadyBooked) {
        try {
          const booked = await api.commerce.bookServiceSlot(slotPrefill.slotId)
          if (!booked?.orderId) {
            throw new Error("Respons booking tidak lengkap")
          }
          submitLock.current = false
          setSubmitting(false)
          router.push(ROUTES.orderDetail(booked.orderId))
          return
        } catch (slotErr) {
          submitLock.current = false
          setSubmitting(false)
          // Klasifikasi toast: error mutasi non-blokir via showMutationError.
          showMutationError(toast.show, {
            failTitle: translate("Slot jasa gagal dipesan"),
            uncertainHint: translate("Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi."),
            err: slotErr,
            scope: "create-transaction:slot-jasa-dipesan",
          })
          return
        }
      }
      // Backend memakai `deliveryDeadlineAt` bila ada; `deliveryDeadlineDays`
      // tetap dikirim sebagai fallback = selisih hari kalender dari hari ini
      // (min 1, max ikut batas picker 14).
      const deadlineDaysFallback = Math.min(
        MAX_DEADLINE_DAYS,
        Math.max(
          1,
          Math.round(
            (normalizePickerDate(deadlineDate).getTime() - normalizePickerDate(new Date()).getTime()) /
              86_400_000,
          ),
        ),
      )
      const base = {
        role,
        title: title.trim(),
        description: description.trim(),
        orderType,
        orderValue,
        deliveryDeadlineDays: deadlineDaysFallback,
        deliveryDeadlineAt: deadlineDate.toISOString(),
        feeResponsibility,
      }
      if (mode === "link") {
        const dto: CreateOrderLinkDto = {
          ...base,
          counterpartUsername: counterpart.trim() || undefined,
          // TRX-009: pembuat link sebagai BUYER wajib menyertakan alamatnya;
          // sebagai SELLER, alamat diisi penerima saat accept link.
          ...(shippingAddressRequired && shippingAddress
            ? { shippingAddressId: shippingAddress.id }
            : {}),
        }
        const link = await api.orders.createOrderLink(
          dto,
          submitKeyRef.current ?? (submitKeyRef.current = createIdempotencyKey()),
        )
        submitKeyRef.current = null
        // P1-3: transaksi berhasil → draft tidak boleh ditawarkan lagi.
        discardTransactionDraft()
        toast.show({
          title: "Tautan pesanan dibuat",
          description: "Bagikan tautan ke lawan transaksi.",
          tone: "success",
          duration: 4000,
        })
        // NAV-012: sukses = keluar yang disengaja — lewat effect agar
        // `beforeRemove` tidak mencegat replace ini sebagai "buang isian".
        pendingReplace.current = link.token ? ROUTES.orderLink(link.token) : ROUTES.orderLinks
        setIntentionalLeave(true)
        return
      }
      // Unified v2: map kategori ke orderType lama + sertakan field 3-dimensi.
      // Backend mendukung fulfillment/participantMode/category (fallback ke
      // orderType bila field baru tidak ada).
      const categoryToOrderType: Record<OrderCategory, CreateOrderDto["orderType"]> = {
        FISIK: "PHYSICAL_GOODS",
        DIGITAL: "DIGITAL_GOODS",
        JASA: "SERVICE",
      }
      const dto = {
        ...base,
        counterpartUsername: counterpart.trim(),
        voucherCode: effectiveVoucherCode,
        // Field 3-dimensi (unified v2)
        ...(category ? { orderType: categoryToOrderType[category] } : {}),
        fulfillment,
        participantMode,
        ...(category ? { category } : {}),
        ...(fulfillment === "PREORDER" && preorderDate
          ? { preorderEstimatedDate: toDateString(preorderDate) }
          : {}),
        ...(category === "JASA" && scheduledDate ? { scheduledDate: toDateString(scheduledDate) } : {}),
        // P2-7: Detail patungan dihapus — mode GROUP diblokir sementara.
        // Detail kategori
        ...(category === "FISIK"
          ? { itemCondition, ...(itemCondition === "bekas" && conditionDesc ? { conditionDescription: conditionDesc } : {}) }
          : {}),
        ...(category === "DIGITAL"
          ? { deliveryMethod, warrantyDays: Math.max(0, Math.floor(Number(warrantyDays) || 0)) }
          : {}),
        ...(category === "JASA"
          ? {
              ...(deliverables ? { deliverables } : {}),
              ...(serviceLocation ? { serviceLocation } : {}),
              ...(cancellationPolicy ? { cancellationPolicy } : {}),
            }
          : {}),
        // TRX-009: alamat pengiriman untuk barang fisik (backend fail-closed).
        ...(orderType === "PHYSICAL_GOODS" && shippingAddress
          ? { shippingAddressId: shippingAddress.id }
          : {}),
        // Poin 2 (2026-10-04): slot jasa yang dibayar order ini — selaras
        // `bookAndCreateOrder` backend (slot sudah di-booking di atas bila
        // belum; yang sudah di-booking di halaman detail tetap diidentifikasi
        // agar order terikat ke booking yang benar).
        ...(slotPrefill ? { slotId: slotPrefill.slotId } : {}),
      } as CreateOrderDto
      const order = await api.orders.createOrder(
        dto,
        submitKeyRef.current ?? (submitKeyRef.current = createIdempotencyKey()),
      )
      submitKeyRef.current = null
      // Poin 2 (2026-10-04): order untuk partisipasi jastip/patungan —
      // daftarkan otomatis via endpoint create-order yang baru, TANPA user
      // menempel ID manual (pola lama link-order + BottomSheet dihapus).
      // Hanya untuk mode "direct": order link (mode "link") tidak terikat
      // partisipasi. Gagal di sini TIDAK membatalkan order yang sudah
      // terbentuk — tampilkan peringatan eksplisit agar user tahu status
      // partisipasinya belum tercatat dan bisa menghubungi bantuan.
      if (mode === "direct" && participantPrefill && order.id) {
        try {
          const registerOrderForParticipant =
            participantPrefill.kind === "jastip"
              ? api.commerce.createOrderFromJastipParticipant
              : api.commerce.createOrderFromPatunganParticipant
          await registerOrderForParticipant(participantPrefill.id, order.id)
        } catch (registerErr) {
          toast.show({
            title: "Transaksi dibuat, tapi gagal mencatat ke partisipasi",
            description: userMessage(registerErr),
            tone: "warning",
            duration: 6000,
          })
        }
      }
      // P1-3: transaksi berhasil → draft tidak boleh ditawarkan lagi.
      discardTransactionDraft()
      toast.show({
        title: "Transaksi dibuat",
        description: "Menunggu konfirmasi lawan transaksi.",
        tone: "success",
        duration: 4000,
      })
      // NAV-012: sukses = keluar yang disengaja (lihat komentar di atas).
      pendingReplace.current = order.id ? ROUTES.orderDetail(order.id) : ROUTES.transactions
      setIntentionalLeave(true)
    } catch (err) {
      if (isApiError(err) && err.backendCode === "KYC_REQUIRED") {
        setKycReason(kycReasonMessage(err.message))
      } else {
        // M-27 (audit end-to-end, issue #102): gagal tak pasti (PARSE/timeout
        // SETELAH objek terbentuk di server) menahan kunci submit + memakai
        // pesan "mungkin sudah dibuat" — dulu "Gagal membuat transaksi" mutlak
        // mendorong submit ulang = order/link ganda.
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        if (!uncertain) submitKeyRef.current = null
        // String literal penuh (kunci i18n = teks sumber; jangan rakit dinamis).
        toast.show({
          title: uncertain
            ? mode === "link"
              ? "Tautan pesanan mungkin sudah dibuat"
              : "Transaksi mungkin sudah dibuat"
            : mode === "link"
              ? "Gagal membuat tautan pesanan"
              : "Gagal membuat transaksi",
          description: uncertain
            ? "Koneksi terputus di tengah pemeriksaan server — periksa daftar transaksi sebelum mengirim ulang."
            : isApiError(err)
              ? userMessage(err)
              : undefined,
          tone: uncertain ? "warning" : "danger",
        })
      }
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }, [
    canSubmit,
    mode,
    role,
    counterpart,
    title,
    description,
    orderType,
    orderValue,
    deadlineDate,
    feeResponsibility,
    voucher?.code,
    toast.show,
    discardTransactionDraft,
    slotPrefill,
    participantPrefill,
  ])

  const counterpartRequired = mode === "direct"

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshFee(), validateCounterpart()])
    setRefreshing(false)
  }, [refreshFee, validateCounterpart])

  const goNext = useCallback(() => setStep((s) => Math.min(LAST_STEP, s + 1)), [])
  // goPrev didefinisikan lebih awal sebagai goPrevEarly (untuk usePreventRemove).
  const goPrev = goPrevEarly
  const meta = STEPS[step]
  const feeConfirmed = fee != null && confirmedFeeKey === feeKey

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          {/* N-05 (audit escrow 2026-09-24): galat fee tampil di SEMUA langkah —
              dulu baru muncul di langkah terakhir, pengguna mengisi 3 langkah
              tanpa tahu fee tidak bisa dihitung. */}
          {feeError ? (
            <View className="gap-1">
              <Text variant="caption" tone="danger">
                Biaya belum terkonfirmasi: {feeError}. Tarik untuk memuat ulang.
              </Text>
              {/* M-24 (audit end-to-end, issue #20): jalan keluar TERLIHAT —
                  dulu satu-satunya pemulihan adalah gestur tarik-untuk-muat-ulang
                  yang tidak disebut tombol mana pun; "Lanjut" terasa terkunci
                  permanen setelah calculate-fee gagal (jaringan). */}
              <Button variant="ghost" size="sm" loading={feeLoading} onPress={() => void refreshFee()}>
                Hitung ulang biaya
              </Button>
            </View>
          ) : null}
          <ButtonGroup>
            {step > 0 ? (
              <Button variant="secondary" onPress={goPrev} disabled={submitting}>
                Kembali
              </Button>
            ) : null}
            {step < LAST_STEP ? (
              <Button onPress={goNext} disabled={!stepValid[step]}>
                Lanjut
              </Button>
            ) : (
              <Button loading={submitting} disabled={!canSubmit} onPress={() => void handleSubmit()}>
                {mode === "link" ? "Buat tautan pesanan" : "Buat transaksi"}
              </Button>
            )}
          </ButtonGroup>
        </View>
      }
    >
      <Header
        title="Buat transaksi"
        progress={(step + 1) / STEPS.length}
        onBack={step === 0 ? undefined : goPrev}
      />
      <PullToRefresh
        key={step}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {/* v2: tiap langkah reveal (fast). <PullToRefresh key={step}> me-remount
            saat langkah pindah, jadi FadeIn ikut remount dan reveal terulang
            otomatis — tanpa key tambahan. */}
        <FadeIn duration="fast">
        {/* Kepala langkah ala Register: judul + penjelasan dengan nomor langkah. */}
        <View className="gap-2 pb-2 pt-6">
          <Text variant="caption" tone="secondary">
            {translate("Langkah {x} dari {y}", { x: step + 1, y: STEPS.length })}
          </Text>
          <Heading level={1}>
            {meta.heading}
          </Heading>
          <Text variant="body" tone="secondary">
            {meta.description}
          </Text>
        </View>

        {step === 0 ? (
          <CategoryStep value={category} onChange={setCategory} />
        ) : null}

        {step === 1 ? (
          category ? (
            <SystemStep
              category={category}
              fulfillment={fulfillment}
              onFulfillmentChange={setFulfillment}
              preorderDate={preorderDate}
              onPreorderDateChange={setPreorderDate}
              scheduledDate={scheduledDate}
              onScheduledDateChange={setScheduledDate}
            />
          ) : null
        ) : null}

        {step === 2 ? (
          <ParticipantStep
            mode={participantMode}
            onModeChange={setParticipantMode}
            counterpartNode={
              <CounterpartStep
                value={counterpart}
                onChange={setCounterpart}
                required={counterpartRequired}
                minUsername={MIN_USERNAME}
                state={counterpartState}
                name={counterpartName}
                username={counterpartUsername}
                verified={counterpartVerified}
                warnings={counterpartWarnings}
                reason={counterpartReason}
              />
            }
          />
        ) : null}

        {step === 3 ? (
          <FormSection title="Rincian pesanan">
            {/* Unified v2: info kategori yang dipilih */}
            {category ? (
              <View className="rounded-xl bg-surface p-3">
                <Text variant="caption" tone="secondary">
                  Kategori: <Text weight={700}>{ORDER_CATEGORY_LABELS[category]}</Text>
                  {" · "}
                  {category === "JASA"
                    ? `Jadwal: ${scheduledDate ? toDateString(scheduledDate) : "-"}`
                    : `${FULFILLMENT_LABELS[fulfillment]}${fulfillment === "PREORDER" && preorderDate ? ` (${toDateString(preorderDate)})` : ""}`}
                  {" · "}
                  {PARTICIPANT_MODE_LABELS[participantMode]}
                </Text>
              </View>
            ) : null}
            {/* Batch 43 (item 10): slot jasa dari detail etalase — di-booking
                saat transaksi dikonfirmasi (lihat handleSubmit). */}
            {slotPrefill ? (
              <View className="gap-1 rounded-md border border-info bg-info-soft p-3">
                <Text variant="body" weight={600} tone="info">
                  {translate("Slot jasa terpilih")}
                </Text>
                <Text variant="caption" tone="secondary">
                  {slotPrefill.slotDate
                    ? `${slotPrefill.slotDate}${slotPrefill.slotTime ? ` · ${slotPrefill.slotTime}` : ""}`
                    : translate("Slot akan dipesan saat Anda menekan Buat transaksi.")}
                  {slotPrefill.alreadyBooked ? ` — ${translate("sudah dipesan")}` : ""}
                </Text>
              </View>
            ) : null}
            <Field label="Judul" required errorText={titleError}>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Jasa desain logo"
                maxLength={100}
              />
            </Field>
            <Field label="Deskripsi" required errorText={descriptionError}>
              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="Jelaskan detail pekerjaan (min. 10 karakter)"
                maxLength={500}
                numberOfLines={4}
              />
            </Field>
            <Field label="Jenis transaksi" required>
              <OrderTypeSelector
                value={orderType}
                onChange={setOrderType}
                labels={ORDER_TYPE_LABELS}
              />
            </Field>
            {/* TRX-009: alamat pengiriman WAJIB untuk barang FISIK — tombol
                Lanjut/submit diblokir sampai alamat lengkap terpilih.
                Link yang dibuat sebagai SELLER: alamat diisi penerima
                (pembeli) saat accept link, bukan di sini. */}
            {orderType === "PHYSICAL_GOODS" && shippingAddressRequired ? (
              <Field
                label={translate("Alamat pengiriman")}
                required
                helperText={translate("Alamat tujuan barang dikirim — bisa diubah di buku alamat.")}
                errorText={
                  shippingAddressMissing.length > 0
                    ? shippingAddressMissing.includes("alamat")
                      ? translate("Pilih alamat pengiriman untuk barang fisik ini.")
                      : translate("Alamat belum lengkap: {x}.", { x: shippingAddressMissing.join(", ") })
                    : undefined
                }
              >
                <AddressPicker selected={shippingAddress} onSelect={setShippingAddress} />
              </Field>
            ) : null}
            {orderType === "PHYSICAL_GOODS" && mode === "link" && role === "SELLER" ? (
              <Alert tone="info" title={translate("Alamat pengiriman")}>
                {translate("Alamat pengiriman akan diisi oleh pembeli saat menerima tautan ini.")}
              </Alert>
            ) : null}
            <AmountInput
              value={orderValue}
              onChange={setOrderValue}
              min={MIN_ORDER_VALUE}
              max={MAX_ORDER_VALUE}
              label="Nilai transaksi"
            />
            {/* F10 (audit 2026-09-26): input angka hari diganti kalender
                <DateField> — tanpa native module (OTA-compatible).
                Belum pilih = placeholder "Pilih tanggal", bukan auto-fill "1". */}
            <DateField
              label="Tenggat pengiriman"
              required
              helperText={translate("Tanggal yang bisa dipilih: besok hingga {x} hari ke depan.", {
                x: MAX_DEADLINE_DAYS,
              })}
              errorText={deadlineError}
              value={deadlineDate}
              onChange={(date) => {
                setDeadlineDate(date)
                setDeadlineTouched(false)
              }}
              onClose={() => {
                // Sheet ditutup (tanpa memilih) = field sudah disentuh — error
                // "pilih tanggal" boleh tampil. Jalur pilih-tanggal juga lewat
                // sini (auto-close), tapi tanggalnya sudah terisi sehingga
                // `deadlineError` tetap null.
                setDeadlineTouched(true)
              }}
            />
            {/* Unified v2: field wajib per kategori */}
            {category === "FISIK" ? (
              <>
                <Field label="Kondisi barang" required>
                  <View className="flex-row gap-2">
                    {(["baru", "bekas"] as const).map((c) => (
                      <PressableScale
                        key={c}
                        onPress={() => setItemCondition(c)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: itemCondition === c }}
                        accessibilityLabel={c === "baru" ? "Baru" : "Bekas"}
                      >
                        <View
                          className={cn(
                            "rounded-xl border px-4 py-3",
                            itemCondition === c ? "border-primary bg-primary-soft" : "border-border bg-surface",
                          )}
                        >
                          <Text variant="body" weight={600}>
                            {c === "baru" ? "Baru" : "Bekas"}
                          </Text>
                        </View>
                      </PressableScale>
                    ))}
                  </View>
                </Field>
                {itemCondition === "bekas" ? (
                  <Field label="Deskripsi kondisi" required>
                    <Input
                      value={conditionDesc}
                      onChangeText={setConditionDesc}
                      placeholder="Contoh: lecet kecil di sudut kiri"
                      multiline
                    />
                  </Field>
                ) : null}
              </>
            ) : null}
            {category === "DIGITAL" ? (
              <>
                <Field label="Metode serah-terima" required>
                  <View className="flex-row flex-wrap gap-2">
                    {(["file", "kode", "akun", "lainnya"] as const).map((m) => (
                      <PressableScale
                        key={m}
                        onPress={() => setDeliveryMethod(m)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: deliveryMethod === m }}
                        accessibilityLabel={m}
                      >
                        <View
                          className={cn(
                            "rounded-xl border px-4 py-3",
                            deliveryMethod === m ? "border-primary bg-primary-soft" : "border-border bg-surface",
                          )}
                        >
                          <Text variant="body" weight={600} className="capitalize">
                            {m}
                          </Text>
                        </View>
                      </PressableScale>
                    ))}
                  </View>
                </Field>
                <Field
                  label="Masa garansi (hari)"
                  required
                  errorText={
                    !warrantyDaysValid ? "Masa garansi harus angka 0 atau lebih" : undefined
                  }
                >
                  <Input
                    value={warrantyDays}
                    onChangeText={setWarrantyDays}
                    placeholder="7"
                    keyboardType="numeric"
                  />
                </Field>
              </>
            ) : null}
            {category === "JASA" ? (
              <>
                <Field label="Deliverable (hasil yang diserahkan)" required>
                  <Input
                    value={deliverables}
                    onChangeText={setDeliverables}
                    placeholder="Contoh: 3 konsep logo, file AI + PNG"
                    multiline
                  />
                </Field>
                <Field label="Lokasi" required>
                  <Input
                    value={serviceLocation}
                    onChangeText={setServiceLocation}
                    placeholder="Jakarta Selatan / Online"
                  />
                </Field>
                <Field label="Kebijakan pembatalan" required>
                  <Input
                    value={cancellationPolicy}
                    onChangeText={setCancellationPolicy}
                    placeholder="Contoh: Batal H-3 refund 50%, H-1 tidak refund"
                    multiline
                  />
                </Field>
              </>
            ) : null}
          </FormSection>
        ) : null}

        {step === LAST_STEP ? (
          <>
            <FeeServiceSection
              feeResponsibility={feeResponsibility}
              onChangeFeeResponsibility={setFeeResponsibility}
              feeConfirmed={feeConfirmed}
              fee={fee}
              role={role}
              orderValue={orderValue}
              voucherDiscount={voucher?.discount}
              feeLoading={feeLoading}
              onOpenSchedule={() => void openSchedule()}
              showShippingNote={orderType === "PHYSICAL_GOODS"}
            />

            {mode === "direct" && sellerIdForVoucher ? (
              <Text variant="caption" tone="secondary">
                {translate("Hanya satu voucher yang bisa dipakai per transaksi: pilih voucher platform atau voucher toko penjual.")}
              </Text>
            ) : null}

            {mode === "direct" ? (
              <VoucherSection
                title={translate("Voucher platform")}
                initialCode={params.voucherCode}
                applied={voucher ?? undefined}
                onApply={(code) => void handleApplyVoucher(code)}
                onRemove={() => setVoucher(null)}
                applying={applyingVoucher}
                errorText={voucherError}
                onCodeChange={() => setVoucherError(undefined)}
              />
            ) : null}

            {/* Batch 43 (item 9): voucher toko milik penjual — hanya bila
                penjual teridentifikasi (lawan tervalidasi / diri sendiri). */}
            {mode === "direct" && sellerIdForVoucher ? (
              <VoucherSection
                title={translate("Voucher toko penjual")}
                applied={sellerVoucher ?? undefined}
                onApply={(code) => void handleApplySellerVoucher(code)}
                onRemove={() => setSellerVoucher(null)}
                applying={applyingSellerVoucher}
                errorText={sellerVoucherError}
                onCodeChange={() => setSellerVoucherError(undefined)}
              />
            ) : null}

            <OrderSummarySection
              mode={mode}
              role={role}
              counterpart={counterpart}
              counterpartName={counterpartName}
              title={title}
              orderType={orderType}
              orderValue={orderValue}
              deadlineDate={deadlineDate}
              feeResponsibility={feeResponsibility}
              voucherCode={effectiveVoucherCode}
              shippingAddressLabel={
                orderType === "PHYSICAL_GOODS" && shippingAddress
                  ? `${addressLabelText(shippingAddress)} — ${shippingAddress.recipientName}, ${shippingAddress.addressLine}, ${shippingAddress.city} ${shippingAddress.postalCode}`
                  : undefined
              }
            />

            {/*
             * D09 (batch 139): alamat aktif TERLIHAT di ringkasan, dekat CTA —
             * label, penerima, dan kota ditampilkan eksplisit (bukan hanya
             * di langkah detail). Bila belum dipilih/tidak lengkap, tampilkan
             * peringatan + jalan kembali ke langkah detail — jangan biarkan
             * order fisik terkirim tanpa alamat yang jelas.
             */}
            {/* TRX-009: hanya tampilkan kartu alamat bila alamat memang wajib
                di langkah ini — mode link SELLER dikecualikan (pembeli mengisi
                alamat saat accept link). */}
            {shippingAddressRequired ? (
              <ShippingAddressSummaryCard
                address={shippingAddress}
                onFix={() => setStep(2)}
              />
            ) : null}
          </>
        ) : null}
        </FadeIn>
      </PullToRefresh>
      <FeeScheduleSheet
        visible={scheduleOpen}
        onRequestClose={() => setScheduleOpen(false)}
        scheduleLoading={scheduleLoading}
        schedule={schedule}
      />

      {/* NAV-012: konfirmasi sebelum Back membuang isian transaksi. */}
      <Dialog
        title="Buang isian transaksi?"
        description="Isian yang sudah diketik akan hilang dan tidak bisa dikembalikan."
        visible={discardOpen}
        confirmLabel="Buang"
        cancelLabel="Lanjutkan mengisi"
        destructive
        onConfirm={() => {
          setDiscardOpen(false)
          // P1-3: isian dibuang atas permintaan pengguna → draft lokal juga.
          discardTransactionDraft()
          // Jangan dispatch di sini: guard masih aktif sampai commit
          // berikutnya dan `beforeRemove` akan membuka dialog lagi.
          // Effect `intentionalLeave` mengeksekusi aksi yang tertunda.
          setIntentionalLeave(true)
        }}
        onCancel={() => {
          pendingNavigation.current = null
          setDiscardOpen(false)
        }}
        onRequestClose={() => {
          pendingNavigation.current = null
          setDiscardOpen(false)
        }}
      />

      {/* P1-3: tawarkan draft yang tersimpan (<= 24 jam) — pemulihan tidak
          pernah diam-diam; nominal & lawan transaksi bisa sudah basi. */}
      <Dialog
        title="Lanjutkan draft transaksi?"
        description={
          draftOffer
            ? translate(
                "Draft dari {x} ditemukan di perangkat ini. Pulihkan isian itu, atau mulai dari form kosong?",
                { x: formatDateTimeWIB(draftOffer.savedAt) },
              )
            : undefined
        }
        visible={draftOffer != null}
        confirmLabel="Pulihkan"
        cancelLabel="Mulai baru"
        onConfirm={() => {
          if (draftOffer) restoreDraft(draftOffer)
        }}
        onCancel={() => {
          setDraftOffer(null)
          discardTransactionDraft()
        }}
        onRequestClose={() => {
          setDraftOffer(null)
          discardTransactionDraft()
        }}
      />

      <Dialog
        title="Verifikasi identitas diperlukan"
        description={
          (kycReason ??
            "Transaksi ini membutuhkan verifikasi identitas (KYC).") +
          " Selesai verifikasi, Anda bisa melanjutkan transaksi tanpa batas nilai tersebut."
        }
        visible={kycReason != null}
        confirmLabel="Verifikasi sekarang"
        cancelLabel="Nanti dulu"
        onConfirm={() => {
          setKycReason(null)
          router.push(ROUTES.kyc)
        }}
        onCancel={() => setKycReason(null)}
        onRequestClose={() => setKycReason(null)}
      />
    </Screen>
  )
}
