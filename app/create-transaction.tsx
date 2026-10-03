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
import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native"
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
  CreateIntroStep,
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
import { AddressPicker } from "@/components/ui/address-picker"
import type { Address } from "@/lib/api/commerce"
import { addressLabelText } from "@/lib/api/commerce"
import { addressMissingFields } from "@/lib/wallet-batch139"
import { translate } from "@/lib/i18n/translate"

const DEBOUNCE_MS = 400
const MIN_ORDER_VALUE = AMOUNT_LIMITS.order.minimum
const MAX_ORDER_VALUE = AMOUNT_LIMITS.order.maximum
const MIN_TITLE = API_CONSTRAINTS.CreateOrderDto.title.minLength
const MIN_DESCRIPTION = API_CONSTRAINTS.CreateOrderDto.description.minLength
const MIN_USERNAME = API_CONSTRAINTS.CreateOrderDto.counterpartUsername.minLength
const MAX_DEADLINE_DAYS = API_CONSTRAINTS.CreateOrderDto.deliveryDeadlineDays.maximum

type Mode = "direct" | "link"

const STEPS = [
  {
    title: "Cara & peran",
    heading: "Bagaimana transaksinya?",
    description: "Pilih cara membuat pesanan dan peran Anda dalam transaksi ini.",
  },
  {
    title: "Mitra transaksi",
    heading: "Siapa mitra transaksi Anda?",
    description: "Kami memvalidasi username mitra sebelum Anda lanjut.",
  },
  {
    title: "Detail",
    heading: "Rincian pesanan",
    description: "Jelaskan apa yang ditransaksikan dan berapa nilainya.",
  },
  {
    title: "Biaya & kirim",
    heading: "Periksa & kirim",
    description: "Periksa biaya dan ringkasan sebelum pesanan dibuat.",
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
    return (
      "Total nilai transaksi aktif Anda (ditambah transaksi ini) mencapai batas " +
      "Rp2.000.000. Selesaikan verifikasi identitas (KYC) untuk melanjutkan " +
      "membuat transaksi."
    )
  }
  if (/rolling/i.test(backendMessage)) {
    return (
      "Total transaksi 30 hari terakhir Anda mencapai batas. Selesaikan " +
      "verifikasi identitas (KYC) untuk melanjutkan membuat transaksi."
    )
  }
  return "Transaksi dengan nilai Rp2.000.000 ke atas membutuhkan verifikasi identitas (KYC)."
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
  const [mode, setMode] = useState<Mode>("direct")
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
   * tombol "Beli Sekarang") — prefill tidak lengkap, tapi "Cara & peran"
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
    voucher != null ||
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
  const pendingNavigation = useRef<NavigationAction | null>(null)
  const pendingReplace = useRef<Parameters<typeof router.replace>[0] | null>(null)

  usePreventRemove(dirty && !intentionalLeave, ({ data }) => {
    if (submitting) return
    pendingNavigation.current = data.action
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
    else router.back()
  }, [intentionalLeave, navigation])

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
  const detailValid =
    titleTrimmed.length >= MIN_TITLE &&
    descriptionTrimmed.length >= MIN_DESCRIPTION &&
    isValidAmount(orderValue, AMOUNT_LIMITS.order) &&
    deadlineDate != null &&
    // TRX-009: barang fisik tidak bisa lanjut/submit tanpa alamat lengkap.
    shippingAddressValid
  const feeValid = confirmedFeeKey === feeKey && !feeLoading && !!fee
  const stepValid = [true, counterpartValid, detailValid, feeValid && counterpartValid && detailValid]
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
      if (draft.current.feeKey === started) {
        setFee(null)
        setConfirmedFeeKey(null)
        setFeeError(userMessage(error))
      }
    } finally {
      if (draft.current.feeKey === started) setFeeLoading(false)
    }
  }, [orderValue, feeResponsibility, voucher?.code, role, feeKey])

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
          setVoucherError(res.message ?? "Kode voucher tidak berlaku.")
          return
        }
        const v = res.voucher
        setVoucher({
          code: v?.code ?? code,
          // Voucher valid tanpa nominal dari server: simpan `undefined`, bukan
          // NaN — NaN merambat ke <Amount> sebagai "Rp—" dan ke perhitungan
          // biaya sebagai angka yang terlihat sah.
          discount: Number.isFinite(v?.discountValue) ? v?.discountValue : undefined,
          title: v?.title,
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
            ? "Gagal memeriksa voucher — periksa koneksi, lalu coba lagi."
            : "Kode voucher tidak berlaku.",
        )
      } finally {
        setApplyingVoucher(false)
      }
    },
    [orderValue, role],
  )

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
          setSellerVoucherError(res.message ?? "Kode voucher toko tidak berlaku.")
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
      // Batch 43 (item 10): booking slot jasa dilakukan SAAT transaksi
      // dikonfirmasi — gagal booking = transaksi dibatalkan (jangan buat
      // order untuk slot yang tidak terpesan). Slot yang sudah di-booking
      // di halaman detail tidak di-booking ulang.
      if (slotPrefill && !slotPrefill.alreadyBooked) {
        try {
          await api.commerce.bookServiceSlot(slotPrefill.slotId)
        } catch (slotErr) {
          submitLock.current = false
          setSubmitting(false)
          toast.show({
            title: translate("Slot jasa gagal dipesan"),
            description: userMessage(slotErr),
            tone: "danger",
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
      const dto: CreateOrderDto = {
        ...base,
        counterpartUsername: counterpart.trim(),
        voucherCode: effectiveVoucherCode,
        // TRX-009: alamat pengiriman untuk barang fisik (backend fail-closed).
        ...(orderType === "PHYSICAL_GOODS" && shippingAddress
          ? { shippingAddressId: shippingAddress.id }
          : {}),
      }
      const order = await api.orders.createOrder(
        dto,
        submitKeyRef.current ?? (submitKeyRef.current = createIdempotencyKey()),
      )
      submitKeyRef.current = null
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
  ])

  const counterpartRequired = mode === "direct"

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refreshFee(), validateCounterpart()])
    setRefreshing(false)
  }, [refreshFee, validateCounterpart])

  const goNext = useCallback(() => setStep((s) => Math.min(LAST_STEP, s + 1)), [])
  const goPrev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])
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
        {/* Kepala langkah ala Register: H1 + penjelasan, progres di header.
            Teks "Langkah X dari Y — judul" DIHAPUS (2026-09-23): progres
            langkah sudah terwakili <StepProgress> di header — dua penanda
            untuk satu fakta adalah kebisingan. */}
        <View className="gap-2 pb-2 pt-6">
          <Heading level={1}>
            {step === 1 ? translate("Siapa mitra transaksi Anda?") : meta.heading}
          </Heading>
          <Text variant="body" tone="secondary">
            {meta.description}
          </Text>
        </View>

        {step === 0 ? (
          <>
            <CreateIntroStep mode={mode} onChangeMode={setMode} role={role} onChangeRole={setRole} />
          </>
        ) : null}

        {step === 1 ? (
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
        ) : null}

        {step === 2 ? (
          <FormSection title="Rincian pesanan">
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

            {mode === "direct" ? (
              <VoucherSection
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
