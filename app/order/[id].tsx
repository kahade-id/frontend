/**
 * Screen — Detail Order (GET /v1/orders/{id}).
 *
 * Aksi per status × peran (semua lib/api/orders):
 *   PENDING_PAYMENT  pembeli : bayar saldo + PIN (POST /pay) ATAU QRIS
 *                              (POST /pay-qris → poll GET /payment-status)
 *                    penjual : terima / tolak (POST /confirm)
 *   PAID             penjual : mulai proses (POST /process)
 *   PROCESSING       penjual : isi resi/kurir (PUT /shipping) + bukti kirim
 *   SHIPPED/DELIVERED pembeli: bukti pengiriman (konfirmasi) / tandai selesai
 *   aktif (bukan selesai)    : perpanjang tenggat, buka sengketa
 *                              (POST /dispute), batalkan (POST /cancel +
 *                              alasan ReasonPicker)
 *   COMPLETED                : beri ulasan
 *   selalu                   : invoice, chat, profil lawan
 *
 * Keputusan non-obvious:
 *   - Pembatalan memakai <ReasonPicker> dengan enum `CancelOrderDto.reason`
 *     (sebelumnya selalu "MUTUAL_AGREEMENT" — data alasan jadi tak berguna
 *     untuk analitik backend).
 *   - Tolak order (penjual) dipisah dari batalkan: `confirmOrder({action:
 *     "REJECT", reason})` — endpoint berbeda dari cancel.
 *   - QRIS: QR ditampilkan lewat <QRCodeDisplay>; status di-poll tiap
 *     POLL_MS sampai PAID/EXPIRED/FAILED (interval dibersihkan saat unmount).
 *   - PIN salah ditampilkan sebagai `errorText` PinInput, layar tetap di
 *     langkah PIN (tidak menutup dan memaksa mulai ulang).
 *   - Chat: ruang dicari dari GET /chat/rooms berdasarkan `orderId`; bila
 *     belum ada, arahkan ke daftar chat (API tidak punya endpoint buat ruang).
 *   - Estimasi langkah berikutnya di timeline diambil dari
 *     GET /orders/average-durations (key = status berikutnya, nilai jam) —
 *     gagal → tanpa estimasi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ClockCounterClockwise, ShieldCheck, X } from "phosphor-react-native"

import { api, isApiError, userMessage, type Order, type Wallet } from "@/lib/api"
import { createIdempotencyKey } from "@/lib/api/client"
import { normalizeOrder } from "@/lib/api/orders"
import {
  getAverageDurationsCached,
  isCancellable,
  isDisputable,
  isExtendable,
  isRatingWindowOpen,
  nextOrderStatus,
  type AverageDurations,
} from "@/lib/api/orders"
import { RATING_SNOOZE_MS, isRatingSnoozed, snoozeRatingReminder, useUiPref } from "@/lib/ui-prefs"
import { usePolling } from "@/lib/use-polling"
import { useQrisPayment } from "@/lib/use-qris-payment"
import { assertDeviceNotCompromised } from "@/lib/device-integrity"
import { useOrderTracking } from "@/lib/use-order-tracking"
import { useResultTimer } from "@/lib/use-result-timer"
import type { DisputeCategoryValue } from "@/lib/labels/dispute"
import { type ReasonValue } from "@/components/ui/reason-picker"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { useCopy } from "@/lib/clipboard"
import {
  durationHoursParts,
  formatDateTime,
  formatDateTimeWIB,
  formatRupiah,
} from "@/lib/format"
import { Dialog } from "@/components/ui/modal"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FeeBreakdown } from "@/components/ui/fee-breakdown"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { OrderHistoryTimeline } from "@/components/ui/order-history-timeline"
import { ORDER_STATUS_LABELS } from "@/components/ui/order-status-badge"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import {
  OrderActionSheets,
  OrderSecondaryActions,
  OrderConfirmDialogs,
  OrderPayProgressOverlay,
  OrderPaymentSheet,
} from "@/components/order-action-sheets"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import {
  hasSeenSellerEscrowBanner,
  markSellerEscrowBannerSeen,
} from "@/lib/first-run"
import { MilestoneSection } from "@/components/order-milestones"
import { InstallmentOfferSection } from "@/components/order-installment-offer"
import { OrderAgreementSection } from "@/components/order-agreement-section"
import { DigitalAssetsBuyerSection } from "@/components/showcase/digital-asset-section"
import { ShippingInfoCard } from "@/components/ui/shipping-info-card"
import { ReceiptTicket } from "@/components/receipt/ReceiptTicket"
import { shareReceipt } from "@/components/receipt/shareReceipt"
import { useReceiptQr } from "@/components/receipt/use-receipt-qr"
import { receiptDateRows } from "@/lib/receipt"
import { shortId } from "@/lib/short-id"
import { useToast } from "@/components/ui/toast"
import { buildOrderJourney } from "@/lib/order-journey"
import { OrderDetailActions, OrderRatingReminder } from "@/components/order-detail-actions"
import { OrderStatusHero } from "@/components/ui/order-status-hero"
import {
  ShippingOverdueBanner,
} from "@/components/order-countdown"
import type { ShippingCountdownInput } from "@/lib/order-shipping-countdown"
import { OrderJourney } from "@/components/ui/order-journey"
import { OrderProductCard } from "@/components/ui/order-product-card"
import { OrderPartiesCard } from "@/components/ui/order-parties-card"
import { OrderEscrowCard } from "@/components/ui/order-escrow-card"
import { OrderHelpCard } from "@/components/ui/order-help-card"
import { OrderDetailSkeleton } from "@/components/ui/order-detail-skeleton"

const HISTORY_LIMIT = 50

const NOTE_MAX = 500
/** R2 #108: status terminal — polling berhenti & riwayat penuh dimuat lazy. */
const ORDER_TERMINAL_STATUSES: readonly string[] = [
  "COMPLETED",
  "REFUNDED",
  "EXPIRED",
  "CANCELLED",
]
const DISPUTE_CLAIM_MIN = 20
const DISPUTE_CLAIM_MAX = 2000
// G-12 (audit): kategori sengketa & alasan batal kini dari lib/labels/dispute
// (satu sumber, ditipe dari DTO yang di-generate).

type PayMethod = "balance" | "qris"

type SheetKind = "pay" | "cancel" | "reject" | "dispute" | "shipping" | null

/** Status yang masih butuh rincian biaya dihitung ulang (belum final). */
const EARLY_STATUSES: readonly string[] = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PROCESSING",
  "PENDING_PAYMENT",
  "PAID",
]

/**
 * U5-013 (journey): banner escrow SEKALI-TAMPIL saat penjual membuka detail
 * order. Copy: edukasi alur dana (ditahan escrow → cair setelah pembeli
 * konfirmasi). Dismissible; tidak menyentuh status/order logic.
 */
function SellerEscrowBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-md bg-accent-soft p-3"
    >
      <Icon icon={ShieldCheck} size="sm" tone="accent" />
      <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
        Dana pembeli ditahan escrow — kirim barang dulu, dana cair ke wallet
        Anda setelah pembeli konfirmasi terima.
      </Text>
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel="Tutup info escrow"
        onPress={onDismiss}
      />
    </View>
  )
}

export default function OrderDetailScreen() {
  const { id, sheet: sheetParam } = useLocalSearchParams<{ id: string; sheet?: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()
  /**
   * U5-013 (journey): banner escrow sekali-tampil untuk penjual. Ditempatkan
   * di atas (sebelum early return `if (!order)`) — visibility dikunci saat
   * order termuat sebagai SELLER.
   */
  const [escrowBannerVisible, setEscrowBannerVisible] = useState(false)

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchOrder()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti SELURUH detail pesanan (status, timeline, escrow, biaya) dengan
   * kerangka. Request juga tidak dibatalkan saat layar ditutup.
   *
   * `.catch(() => null)` pada riwayat dan durasi rata-rata DIPERTAHANKAN:
   * keduanya pelengkap, kegagalannya tidak boleh mematikan detail order.
   * Perhitungan biaya susulan juga tetap di dalam fetcher karena hasilnya
   * data server (diturunkan dari order), bukan state UI.
   */
  const query = useApiQuery<{
    order: Order
    history: Awaited<ReturnType<typeof api.orders.getOrderHistory>>["data"]
    /** G-08: masih ada halaman riwayat berikutnya? */
    historyHasMore: boolean
    /** R2 (butir #50): halaman riwayat yang sudah termuat (muat-awal = 1). */
    historyPage: number
    durations: AverageDurations | null
    fee: Awaited<ReturnType<typeof api.orders.calculateFee>> | null
    /**
     * Item 46: kelayakan retur dari server (GET /v1/returns/eligibility) —
     * hanya dicek untuk pembeli + order COMPLETED; `null` = tidak dicek /
     * gagal (fallback ke tombol sekunder lama, fail-closed).
     */
    returnEligible: boolean | null
  }>(
    `order-detail:${id}`,
    async (signal) => {
      const oid = id as string
      // F-05 (audit): `getMe` TIDAK lagi ditarik setiap buka order — hanya
      // fallback bila backend tidak mengisi `myRole` (peran diinfer dari
      // id/username). `average-durations` (statistik global) lewat cache
      // 10 menit per sesi (getAverageDurationsCached).
      const [o, h, d] = await Promise.all([
        api.orders.getOrder(oid, signal),
        api.orders
          .getOrderHistory(oid, { page: 1, limit: HISTORY_LIMIT }, signal)
          .catch((err) => {
            logWarn("order:history", err)
            return null
          }),
        getAverageDurationsCached(signal).catch((err) => {
          logWarn("order:durations", err)
          return null
        }),
      ])
      const me = o.myRole
        ? null
        : await api.users.getMeCached(signal).catch((err) => {
            logWarn("order:me-fallback", err)
            return null
          })
      // BUG#1 (2026-09-26): backend kini mengirim `myRole` eksplisit — pakai
      // sebagai sumber utama. Fallback hanya untuk kompatibilitas: cocokkan
      // `me.userId` (public USR-XXX) dengan buyer/seller.id yang dinormalisasi
      // dari field `userId` backend. JANGAN pakai `me.id` (cuid internal) —
      // dua namespace berbeda sehingga perbandingan tidak pernah cocok.
      // (A-12: inferensi dari username tetap dihapus — username bisa berubah.)
      const publicId = me?.userId
      const role =
        o.myRole ??
        (publicId && o.buyer?.id === publicId
          ? "BUYER"
          : publicId && o.seller?.id === publicId
            ? "SELLER"
            : undefined)
      const resolvedOrder = normalizeOrder({ ...o, myRole: role })
      let fee = resolvedOrder.fee ?? null
      if (
        !fee &&
        (role === "BUYER" || role === "SELLER") &&
        // Status awal (enum backend + alias lama) — fee dibutuhkan sebelum bayar.
        EARLY_STATUSES.includes(resolvedOrder.status)
      ) {
        try {
          fee = await api.orders.calculateFee(
            {
              orderValue: resolvedOrder.orderValue,
              feeResponsibility: resolvedOrder.feeResponsibility,
              role,
              // A-10 (audit escrow 2026-09-24): voucher order asli disertakan
              // — dulu fee dihitung ulang tanpa diskon sehingga angka
              // FeeBreakdown lebih besar dari tagihan sebenarnya.
              voucherCode: resolvedOrder.voucherCode ?? undefined,
            },
            signal,
          )
        } catch {
          // fee opsional
        }
      }
      // R2 (audit ronde-2, butir #108): order selesai tidak lagi membayar
      // langkah SERIAL apa pun — kalkulasi fee hanya berjalan untuk status
      // awal (EARLY_STATUSES di atas; terminal tidak membutuhkan fee), dan
      // riwayat diambil PARALEL dengan detail+durasi (Promise.all), sehingga
      // tidak pernah menambah RTT. Versi lama punya susulan serial fee/riwayat
      // yang ikut menahan TTI order terminal.
      //
      // Item 46: kelayakan retur dicek PARALEL juga — hanya untuk pembeli +
      // COMPLETED. Gagal = null (fallback tombol sekunder, bukan hilang).
      const resolvedForReturnCheck = resolvedOrder
      const returnElig =
        resolvedForReturnCheck.myRole === "BUYER" && resolvedForReturnCheck.status === "COMPLETED"
          ? await api.returns
              .getReturnEligibility(oid, signal)
              .then((e) => e?.eligible === true)
              .catch((err) => {
                logWarn("order:return-eligibility", err)
                return null
              })
          : null
      return {
        order: resolvedOrder,
        history: h?.data ?? [],
        // G-08: halaman berikutnya ada bila meta.totalPages bilang begitu;
        // tanpa meta, halaman penuh = kemungkinan masih ada.
        historyHasMore: h?.meta?.totalPages != null ? h.meta.totalPages > 1 : (h?.data?.length ?? 0) >= HISTORY_LIMIT,
        historyPage: 1,
        durations: d,
        fee,
        returnEligible: returnElig,
      }
    },
    Boolean(id),
  )
  const order = query.data?.order ?? null
  // U5-013 (journey): banner escrow sekali-tampil — hanya saat peran termuat
  // sebagai SELLER dan flag belum pernah tampil.
  useEffect(() => {
    if (order?.myRole !== "SELLER") return
    let alive = true
    void hasSeenSellerEscrowBanner().then((seen) => {
      if (alive && !seen) setEscrowBannerVisible(true)
    })
    return () => {
      alive = false
    }
  }, [order?.myRole])
  const dismissEscrowBanner = useCallback(() => {
    void markSellerEscrowBannerSeen()
    setEscrowBannerVisible(false)
  }, [])
  // QR verifikasi struk bukti pembayaran — defensif: null = tiket tanpa QR
  // (lib/receipt). Hook selalu dipanggil; referenceId null = tidak fetch.
  const orderTicketRef = useRef<View | null>(null)
  // D1-007: QR struk hanya di-fetch bila tiket benar-benar dirender
  // (order.paidAt) — bukan untuk semua order yang dibuka.
  const orderPaymentQr = useReceiptQr("ORDER_PAYMENT", order?.id ?? null, {
    enabled: Boolean(order?.paidAt),
  })
  // R2 (audit ronde-2, butir #21): status pihak lawan (bayar/kirim/konfirmasi)
  // menyegar otomatis tiap 15 detik selama layar terbuka — tanpa pull-to-
  // refresh. Order status terminal berhenti dipoll. Galat ditelan oleh
  // useApiQuery (masuk state error), callback ini tidak melempar.
  // R2 #108: status terminal dipusatkan pada satu konstanta (dipakai polling
  // stop DAN pintasan riwayat terminal di fetcher).
  // D1-005 (perf 2026-09-29): poll hanya mengambil STATUS RINGAN
  // (GET /v1/orders/:id/status, 3 kolom). Bundle penuh (detail + 50 riwayat +
  // durasi + fee) di-refresh HANYA bila status berubah — bukan setiap 15 detik.
  usePolling(
    async () => {
      const oid = id as string
      const light = await api.orders.getOrderStatus(oid).catch(() => null)
      const current = query.data?.order?.status
      if (light && current && light.status !== current) {
        await query.refresh().catch(() => {})
      }
    },
    15_000,
    Boolean(id && order && !ORDER_TERMINAL_STATUSES.includes(order.status)),
  )
  const history = query.data?.history ?? []
  const historyHasMore = query.data?.historyHasMore ?? false
  const durations = query.data?.durations ?? null
  const fee = query.data?.fee ?? null
  /**
   * Lima langkah perjalanan order untuk <OrderJourney> — diturunkan murni
   * dari data server (createdAt/paidAt/completedAt + riwayat), tanpa request
   * tambahan dan tanpa mengubah logika status apa pun.
   */
  const journeySteps = useMemo(
    () =>
      buildOrderJourney({
        status: order?.status ?? "",
        createdAt: order?.createdAt ?? null,
        paidAt: order?.paidAt ?? null,
        completedAt: order?.completedAt ?? null,
        // TRX-014: jenis order agar label tahap pengiriman jujur
        // (jasa/digital tidak menunggu "dikirim").
        orderType: order?.orderType ?? null,
        history: history.map((h) => ({
          toStatus: String(h.toStatus ?? ""),
          createdAt: h.createdAt,
        })),
      }),
    [order?.status, order?.createdAt, order?.paidAt, order?.completedAt, order?.orderType, history],
  )
  /**
   * G-08 (audit escrow 2026-09-24): riwayat order dibatasi `HISTORY_LIMIT`
   * (50) entri per halaman; sisa riwayat sebelumnya tidak bisa dibuka. Tombol
   * "Muat lebih riwayat" memuat halaman berikutnya dan MENAMPAKKANNYA (append,
   * bukan `setData` polos yang menimpa) — `historyHasMore` dari meta.totalPages,
   * heuristik halaman penuh bila meta tidak ada.
   */
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  // R2 (butir #54): affordance loading tombol Chat.
  const [chatBusy, setChatBusy] = useState(false)
  // Batch 43 (item 3): remount MilestoneSection setelah skema cicilan dibuat.
  const [milestoneNonce, setMilestoneNonce] = useState(0)
  const historyPage = query.data?.historyPage ?? 1
  const loadMoreHistory = useCallback(async () => {
    if (!order || historyLoadingMore) return
    setHistoryLoadingMore(true)
    try {
      // R2 (audit ronde-2, butir #50): halaman berikutnya = halaman DIMUAT
      // TERAKHIR + 1, disimpan di data query — derivasi `floor(length/LIMIT)`
      // meminta halaman-1 ULANG saat halaman pertama parsial (30/50 baris)
      // sehingga timeline berlipat (60 render / 30 unik). Refresh data
      // me-reset `historyPage` ke 1 melalui fetcher (satu sumber kebenaran).
      const nextPage = historyPage + 1
      const res = await api.orders.getOrderHistory(order.id, {
        page: nextPage,
        limit: HISTORY_LIMIT,
      })
      const rows = res?.data ?? []
      query.setData((prev) => {
        if (!prev) return prev
        // Dedupe berlapis: baris yang id-nya sudah ada (penomoran server yang
        // bergeser saat entri baru masuk) tidak dirender dua kali.
        const seen = new Set(prev.history.map((r) => (r as { id?: string }).id ?? JSON.stringify(r)))
        const fresh = rows.filter((r) => {
          const key = (r as { id?: string }).id ?? JSON.stringify(r)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        return {
          ...prev,
          history: [...prev.history, ...fresh],
          historyPage: nextPage,
          // M-31 (audit end-to-end, issue #75): `meta.totalPages` juga
          // dipakai saat load-more — heuristik `rows.length >= LIMIT`
          // menyembunyikan "Muat lagi" prematur bila halaman terisi parsial.
          historyHasMore:
            res?.meta?.totalPages != null
              ? res.meta.totalPages > nextPage
              : rows.length >= HISTORY_LIMIT,
        }
      })
    } catch {
      toast.show({
        title: "Gagal memuat riwayat berikutnya. Coba lagi.",
        tone: "danger",
      })
    } finally {
      setHistoryLoadingMore(false)
    }
  }, [order, historyPage, historyLoadingMore, query, toast])
  const { loading, error, refreshing } = query
  const [submitting, setSubmitting] = useState(false)

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [confirmAccept, setConfirmAccept] = useState(false)
  // Item 32: dialog konfirmasi SEBELUM dana escrow dilepas.
  const [confirmComplete, setConfirmComplete] = useState(false)

  // Pembayaran
  const [payMethod, setPayMethod] = useState<PayMethod>("balance")
  /**
   * U5-010/U5-011 (UX-deep 2026-09-29): saldo dompet — HANYA diambil saat
   * sheet bayar dibuka, untuk (a) banner inline "saldo kurang" + tombol
   * "Isi Saldo" di titik bayar, dan (b) default metode QRIS bila saldo <
   * tagihan. Murni baca tampilan: tidak mengubah logika bayar/refund/PIN.
   * (Ditaruh setelah `sheet`/`payMethod` dideklarasikan — hook ini memakai
   * keduanya.)
   */
  const walletQuery = useApiQuery<Wallet>(
    `wallet-for-pay:${id}`,
    (signal) => api.wallet.getWallet(signal),
    sheet === "pay",
    // U5-010: kembali dari layar topup (push di atas layar ini; sheet tetap
    // terbuka di belakang) → saldo disegarkan supaya banner "kurang RpY"
    // langsung mencerminkan topup yang baru selesai.
    { refreshOnFocus: true },
  )
  const walletBalance = walletQuery.data?.balance ?? null
  /**
   * U5-011: default metode bayar = QRIS bila saldo < tagihan. Hanya
   * auto-default — pilihan eksplisit user (payMethodTouchedRef) tidak
   * pernah ditimpa. Flag di-reset di closeSheet supaya pembukaan
   * berikutnya mengevaluasi ulang dari saldo terbaru.
   */
  const payMethodTouchedRef = useRef(false)
  useEffect(() => {
    if (sheet !== "pay" || payMethodTouchedRef.current) return
    const total = fee?.buyerPays
    if (walletBalance != null && total != null && walletBalance < total) {
      setPayMethod("qris")
    }
  }, [sheet, walletBalance, fee?.buyerPays])
  /**
   * U5-010: "Isi Saldo" dari sheet bayar — dorong layar topup; tombol back
   * di sana kembali ke layar ini dengan sheet masih terbuka (state `sheet`
   * tidak di-reset saat push), lalu saldo di-refresh via refreshOnFocus di
   * atas. PIN tetap wajib untuk bayar via saldo — logika otorisasi utuh.
   */
  const handleTopupFromPay = useCallback(() => {
    router.push(ROUTES.topup)
  }, [])
  const [pinError, setPinError] = useState<string | undefined>()
  // Overlay progres saat membayar escrow dari saldo (PIN disubmit).
  const [payProgress, setPayProgress] = useState<"PROCESSING" | "SUCCESS" | "FAILURE" | null>(null)
  const [payProgressError, setPayProgressError] = useState<string | undefined>()
  /**
   * D08 (batch 139): total berubah sejak layar dibuka. `null` = tidak ada
   * perubahan / belum dicek. PIN yang tertunda disimpan di ref — TIDAK di
   * state render (jangan pernah render PIN ke layar).
   */
  const [priceChange, setPriceChange] = useState<{ oldTotal: number; newTotal: number } | null>(null)
  const pendingPinRef = useRef<string | null>(null)
  /**
   * D08: total terbaru yang sudah disetujui pengguna via dialog — cek harga
   * tidak boleh membuka dialog dua kali untuk angka yang sama (loop).
   * Dibersihkan saat sheet bayar ditutup.
   */
  const acceptedTotalRef = useRef<number | null>(null)

  // A-03 (audit): tombol biometrik DIHAPUS dari sheet pembayaran escrow —
  // PayOrderDto mewajibkan `pin` mentah dan tidak ada jalur backend
  // "biometrik → tiket konfirmasi", jadi prompt biometrik yang "sukses"
  // tidak pernah mengirim apa pun. Biometrik hidup di kunci aplikasi
  // (components/app-lock-gate.tsx), bukan di konfirmasi dana.
  const scheduleResult = useResultTimer() // H-09: timer per alur (lihat lib/use-result-timer.ts)

  const submitLock = useRef(false)
  /**
   * M-08 (audit end-to-end 2026-09-24, issue #3/#7): satu `Idempotency-Key`
   * per SIKLUS pembayaran — dibuat saat percobaan pertama, DIPERTAHANKAN saat
   * kegagalan tak pasti (jaringan/PARSE/ABORTED), di-reset setelah sukses atau
   * kegagalan pasti (PIN salah → percobaan berikutnya = pembayaran baru).
   * Dulu tiap retry `payOrder` memakai kunci otomatis baru — server membaca
   * "pembayaran kedua" bila yang pertama sebenarnya sudah terdebit.
   */
  const payKeyRef = useRef<string | null>(null)
  // R2 (audit ronde-2, butir #17): kunci untuk "Konfirmasi terima" (rilis escrow);
  // dibersihkan setelah SUKSES — uncertain-fail mempertahankan untuk retry.
  const completeKeyRef = useRef<string | null>(null)

  /**
   * Pembayaran QRIS: intent + polling + rekonsiliasi pindah ke hook
   * (lib/use-qris-payment.ts) supaya layar ini tidak menambah baris di atas
   * plafon S9 — dan supaya A-14/A-02 punya satu tempat yang bisa diuji.
   */
  const qrisPayment = useQrisPayment({
    orderId: id ?? null,
    fallbackAmount: order?.orderValue ?? 0,
    active: sheet === "pay",
    canCreate: order?.myRole === "BUYER",
    onPaid: () => {
      toast.show({ title: "Pembayaran QRIS diterima", tone: "success", duration: 3000 })
      closeSheet()
      void query.refresh()
    },
    onError: (message) =>
      toast.show({ title: "Gagal membuat QRIS", description: message, tone: "danger" }),
  })
  const { status: qrisStatus, pollError, creating: qrisCreating } = qrisPayment

  // Alasan / form
  const [cancelReason, setCancelReason] = useState<ReasonValue>({ code: undefined, note: "" })
  const [rejectReason, setRejectReason] = useState("")
  const [disputeClaim, setDisputeClaim] = useState("")
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategoryValue | undefined>(undefined)
  const [tracking, setTracking] = useState("")
  const [courier, setCourier] = useState("")

  /**
   * Pra-isi resi & kurir yang dulu terjadi DI DALAM fetcher. Dipindah ke effect
   * karena keduanya input yang bisa diedit user (`onChangeText={setTracking}`
   * baris ~906, `setCourier` ~898) — state UI, bukan data server.
   *
   * A-04 (audit 2026-09-22): versi lama mengisi ulang TANPA SYARAT setiap
   * `order` berganti identitas (pull-to-refresh, hasil `runAction`, tick
   * polling QRIS) sehingga resi/kurir yang sedang diketik penjual terhapus di
   * tengah jalan. Sekarang pengisian hanya terjadi bila order-nya berganti
   * ATAU server benar-benar mengubah nilainya — refresh yang mengembalikan
   * data identik tidak lagi menyentuh state editor.
   */
  const trackedOrderRef = useRef<{ id: string; tracking: string; courier: string } | null>(null)
  useEffect(() => {
    if (!order) return
    const serverTracking = order.trackingNumber ?? ""
    const serverCourier = order.courierName ?? ""
    const previous = trackedOrderRef.current
    const differentOrder = previous === null || previous.id !== order.id
    const serverChanged =
      previous !== null &&
      (previous.tracking !== serverTracking || previous.courier !== serverCourier)
    if (differentOrder || serverChanged) {
      setTracking(serverTracking)
      setCourier(serverCourier)
    }
    trackedOrderRef.current = { id: order.id, tracking: serverTracking, courier: serverCourier }
  }, [order])

  const closeSheet = useCallback(() => {
    setSheet(null)
    setPinError(undefined)
    setDisputeCategory(undefined)
    // U5-011: reset penanda pilihan metode — pembukaan sheet berikutnya
    // mengevaluasi ulang auto-default QRIS dari saldo terbaru.
    payMethodTouchedRef.current = false
    // D08: persetujuan total tidak berlaku untuk siklus bayar berikutnya.
    acceptedTotalRef.current = null
    pendingPinRef.current = null
    setPriceChange(null)
    qrisPayment.reset()
  }, [qrisPayment])

  /**
   * D11 (batch 139): resume checkout yang aman — `?sheet=pay` (dari banner
   * aksi menggantung / kembali dari aplikasi bank) membuka ulang sheet
   * bayar. Status & quote SELALU dibaca ulang dari server oleh query di
   * atas; sheet hanya dibuka bila order memang masih bisa dibayar
   * (fail-closed: param tak dikenal/tidak valid tidak memaksa sheet bayar).
   */
  const paySheetAutoOpened = useRef(false)
  useEffect(() => {
    if (sheetParam !== "pay" || paySheetAutoOpened.current) return
    const o = query.data?.order
    if (!o) return
    const payable =
      (o.status === "WAITING_PAYMENT" || o.status === "PENDING_PAYMENT") && o.myRole === "BUYER"
    if (!payable) return
    paySheetAutoOpened.current = true
    setSheet("pay")
  }, [sheetParam, query.data])

  /** Pembungkus aksi sederhana: loading, toast sukses/gagal, refetch. */
  const runAction = useCallback(
    async (fn: () => Promise<unknown>, success: string, failure: string) => {
      if (submitLock.current) return false
      submitLock.current = true
      setSubmitting(true)
      try {
        // R2 (butir #53): hasil fn diteruskan — respons submitDispute dipakai navigasi.
        const result = await fn()
        toast.show({ title: success, tone: "success", duration: 3000 })
        closeSheet()
        setConfirmAccept(false)
        await query.refresh()
        return result ?? true
      } catch (err) {
        toast.show({
          title: failure,
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
        return false
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [toast.show, closeSheet, query],
  )

  const handlePayPin = useCallback(
    async (pin: string) => {
      if (!order || order.myRole !== "BUYER" || submitLock.current) return
      // R2 (butir #32): handler menolak bayar tanpa nominal escrow terverifikasi.
      if (fee?.buyerPays == null) {
        setPinError("Muat ulang rincian biaya sebelum membayar.")
        return
      }
      // M-1 (audit ronde-2): blokir pembayaran order di perangkat
      // rooted/jailbroken — sebelum PIN diproses & dana bergerak.
      if (!(await assertDeviceNotCompromised())) return
      /*
       * D08 (batch 139): pemeriksaan perubahan harga SEBELUM bayar — harga,
       * ongkir, atau diskon bisa berubah sejak layar dibuka. Quote terbaru
       * diambil ulang (endpoint calculate-fee yang sudah ada) dan
       * dibandingkan dengan total yang ditampilkan; bila berubah, minta
       * persetujuan ulang lewat dialog — fail-closed: batal = tidak bayar.
       *
       * PARSIAL: backend G02 (quote berversi) BELUM ADA — pemeriksaan ini
       * memakai hitung-ulang fee saat ini, bukan perbandingan versi quote
       * server. Setelah G02 tersedia, ganti dengan perbandingan quote ID.
       */
      try {
        const fresh = await api.orders.calculateFee({
          orderValue: order.orderValue,
          feeResponsibility: order.feeResponsibility,
          role: "BUYER",
          voucherCode: order.voucherCode ?? undefined,
        })
        if (
          typeof fresh?.buyerPays === "number" &&
          Number.isFinite(fresh.buyerPays) &&
          fresh.buyerPays !== fee.buyerPays &&
          // Total ini sudah disetujui lewat dialog — jangan tanya dua kali.
          acceptedTotalRef.current !== fresh.buyerPays
        ) {
          pendingPinRef.current = pin
          setPriceChange({ oldTotal: fee.buyerPays, newTotal: fresh.buyerPays })
          return
        }
      } catch {
        // Gagal memuat quote terbaru = jangan bayar buta (fail-closed).
        setPinError("Tidak dapat memeriksa ulang total bayar. Periksa koneksi, lalu coba lagi.")
        return
      }
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      setPayProgressError(undefined)
      setPayProgress("PROCESSING")
      try {
        await api.orders.payOrder(order.id, { pin }, payKeyRef.current ?? (payKeyRef.current = createIdempotencyKey()))
        payKeyRef.current = null
        setPayProgress("SUCCESS")
        scheduleResult(() => {
          setPayProgress(null)
          closeSheet()
          void query.refresh()
        }, "pay")
      } catch (err) {
        /*
         * A-15 (audit 2026-09-22): timeout/jaringan berarti debit MUNGKIN sudah
         * terjadi. Versi lama hanya menampilkan pesan kegagalan lalu membuka
         * sheet PIN lagi — pengguna menekan bayar ulang tanpa tahu state
         * sebenarnya, dan `Idempotency-Key` baru dibuat untuk percobaan itu.
         * Sekarang kegagalan tak pasti memicu penyegaran data order supaya
         * status yang terlihat berasal dari server, bukan asumsi.
         */
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        // C-08 (audit escrow 2026-09-24): non-ApiError TIDAK diterjemahkan
        // menjadi "PIN salah atau saldo tidak cukup" — kesalahan jaringan
        // menutupi penyebab sebenarnya dan menyalahkan PIN pengguna.
        const base = isApiError(err) ? userMessage(err) : "Pembayaran gagal — penyebab tidak diketahui."
        const msg = uncertain
          ? `${base} Status pembayaran mungkin sudah diproses — memuat ulang status…`
          : base
        setPayProgressError(msg)
        setPayProgress("FAILURE")
        // M-08: kegagalan PASTI = pembayaran baru boleh dicoba dengan kunci
        // baru; kegagalan tak pasti MENAHAN kunci yang sama untuk rekonfirmasi.
        if (!uncertain) payKeyRef.current = null
        if (uncertain) {
          invalidateQueryCache()
          void query.refresh()
        }
        // C-09 (audit escrow 2026-09-24): pesan PIN/kesalahan langsung tampil
        // di PinInput SEKARANG — dulu baru diisi setelah overlay 1,4 detik,
        // pengguna menunggu tanpa tahu PIN-nya ditolak.
        // R2 (audit ronde-2, butir #33): PinInput hanya membawa KALIMAT PERTAMA —
        // pesan multi-kalimat penuh tetap wajib tampil SEKALI di overlay
        // (`payProgressError`), bukan dua render identik yang merusak keypad.
        const dotIdx = msg.indexOf(". ")
        const firstSentence = dotIdx > 0 ? msg.slice(0, dotIdx + 1) : msg
        setPinError(firstSentence.length > 90 ? `${firstSentence.slice(0, 90).trimEnd()}…` : firstSentence)
        scheduleResult(() => {
          setPayProgress(null)
        }, "pay")
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [order, fee, closeSheet, query, scheduleResult],
  )

  /**
   * Pembeli memilih "Tampilkan kode QRIS" / "Buat ulang QRIS". Seluruh logika
   * (guard intent ganda, cap polling, rekonsiliasi kegagalan tak pasti) ada di
   * lib/use-qris-payment.ts.
   */
  const handlePayQris = useCallback(() => qrisPayment.createIntent(), [qrisPayment])

  // R2 (audit ronde-2, butir #18): "Buat ulang QRIS" = ganti transaksi QRIS
  // aktif server-side — destruktif bila pengguna baru saja membayar QR lama.
  // Wajib konfirmasi eksplisit; cabang gagal-tak-pasti sudah di hook (A-14).
  const [confirmRecreateQris, setConfirmRecreateQris] = useState(false)

  const openChatBusyRef = useRef(false)
  // Lacak pengiriman (Gap-D) — logika di lib/use-order-tracking.ts (S9).
  const { openTracking } = useOrderTracking(order, toast.show)
  const openChat = useCallback(async () => {
    if (!order) return
    // R2 (audit ronde-2, butir #54): pemindaian room bisa memakan beberapa GET
    // serial — tanpa guard, tap berulang memulai pemindaian ganda. Tombol
    // juga menampilkan spinner lewat state di bawah.
    if (openChatBusyRef.current) return
    openChatBusyRef.current = true
    setChatBusy(true)
    try {
      // G-09 (audit escrow 2026-09-24): cari ruang order via pemindaian
      // berpaginasi yang berhenti saat ketemu (lihat `findChatRoomByOrder`) —
      // dulu memuat daftar ruang sekali besar dan ruang lama di luar halaman
      // pertama tidak ketemu.
      const room = await api.chat.findChatRoomByOrder(order.id)
      router.push(
        room
          ? ROUTES.chatRoom(room.id, room.counterpart?.fullName ?? undefined)
          : ROUTES.chat,
      )
    } catch {
      // Gagal cari ruang → daftar chat adalah pintu keluar yang aman.
      router.push(ROUTES.chat)
    } finally {
      openChatBusyRef.current = false
      setChatBusy(false)
    }
  }, [order])

  /**
   * Item 32: eksekusi rilis escrow — hanya dipanggil dari dialog konfirmasi
   * "Konfirmasi terima barang?" (copy: dana diteruskan & tidak bisa dibatalkan).
   */
  const handleCompleteOrder = useCallback(() => {
    if (!order) return
    setConfirmComplete(false)
    void runAction(
      async () => {
        // M-28: spesifikasi `POST /v1/orders/{id}/complete` TANPA
        // requestBody — jejak bukti melekat pada order di server.
        await api.orders.completeOrder(
          order.id,
          // R2 butir #17: kunci idempotensi per siklus — retry
          // pasca-timeout tidak melepas dana dua kali di server
          // yang mendukung header. Dibersihkan setelah SUKSES.
          completeKeyRef.current ??
            (completeKeyRef.current = createIdempotencyKey()),
        )
        completeKeyRef.current = null
      },
      "Order selesai",
      "Gagal menyelesaikan order",
    )
  }, [order, runAction])

  const expectedNext = useMemo(() => {
    if (!order) return undefined
    const next = nextOrderStatus(order.status)
    if (!next) return undefined
    const hours = durations?.[next]
    // Item 37 (mega-batch FE-IMP-5): estimasi rata-rata TIDAK ditampilkan bila
    // melebihi tenggat aktual — "Biasanya 3 hari" padahal tenggat besok adalah
    // janji palsu. Tenggat aktual yang diketahui klien:
    //   PROCESSING → IN_DELIVERY : shippingDeadline
    //   IN_DELIVERY → COMPLETED  : autoCompleteAt (rilis otomatis)
    // Status lain tidak punya tenggat yang diketahui klien → estimasi tetap.
    if (hours != null) {
      const actualDeadlineAt =
        next === "IN_DELIVERY"
          ? (order.shippingDeadline ?? order.deliveryDeadlineAt ?? null)
          : next === "COMPLETED"
            ? (order.autoCompleteAt ?? null)
            : null
      if (actualDeadlineAt) {
        const deadlineMs = new Date(actualDeadlineAt).getTime()
        // Domain jam server (serverNow) — deadline berasal dari server.
        if (Number.isFinite(deadlineMs) && hours * 3_600_000 > deadlineMs - serverNow()) {
          return undefined
        }
      }
    }
    // G-05: frasa diterjemahkan lewat kunci berkatalog ({x} = angkanya), bukan
    // kalimat Indonesia yang dirakit di lapisan format.
    const parts = hours != null ? durationHoursParts(hours) : null
    if (!parts) return undefined
    // Item 37 (final review): estimasi rata-rata TIDAK ditampilkan bila
    // melebihi tenggat AKTUAL yang mengatur transisi berikutnya — bukan
    // selalu deliveryDeadlineAt:
    //   PROCESSING → IN_DELIVERY : batas kirim penjual (shippingDeadline)
    //   IN_DELIVERY → COMPLETED  : auto-complete (autoCompleteAt)
    //   lainnya                  : deliveryDeadlineAt (fallback lama)
    // Estimasi yang menjanjikan "biasanya 3 hari" padahal tenggatnya besok
    // adalah informasi yang menyesatkan.
    if (hours != null) {
      const relevantDeadline =
        next === "IN_DELIVERY"
          ? (order.shippingDeadline ?? order.deliveryDeadlineAt)
          : next === "COMPLETED"
            ? (order.autoCompleteAt ?? order.deliveryDeadlineAt)
            : order.deliveryDeadlineAt
      if (relevantDeadline) {
        const deadlineMs = new Date(relevantDeadline).getTime()
        if (Number.isFinite(deadlineMs) && serverNow() + hours * 3_600_000 > deadlineMs) {
          return undefined
        }
      }
    }
    return {
      title: ORDER_STATUS_LABELS[next] ?? next,
      description:
        parts.unit === "day"
          ? translate("Biasanya sekitar {x} hari", { x: parts.value })
          : translate("Biasanya sekitar {x} jam", { x: parts.value }),
    }
  }, [order, durations])

  /**
   * J-14: pengingat ulasan yang bisa ditunda (snooze per-order di ui-prefs).
   * POSISI HOOK = PERBAIKAN BUG: keduanya dulu dipanggil SETELAH tiga early
   * return, jadi render "order tiba" memakai dua hook lebih banyak daripada
   * render "masih memuat" → React melempar "Rendered more hooks than during
   * the previous render" → layar jatuh ke ErrorBoundary ("Halaman tidak dapat
   * ditampilkan") tepat saat data masuk. `order` dijaga di dalam callback.
   */
  // R1-002: hanya key ratingSnoozeUntil yang dibaca di layar ini
  // (isRatingSnoozed) — selector per-key, bukan seluruh blob.
  useUiPref("ratingSnoozeUntil")
  /**
   * FE-001: countdown memakai detak 1-Hz TERISOLASI di dalam
   * <AutoReleaseCountdownBox> / <ShippingCountdownBox> /
   * <ShippingOverdueBanner> (ter-memo, masing-masing berlangganan sendiri).
   * Layar hanya meneruskan data STABIL — tidak ada lagi `useClockTick` di
   * level layar yang me-render ulang seluruh layar tiap detik. Jam
   * perbandingan tetap jam server (E-03/F-13): `useClockTick` berakar di
   * `serverNow()`, jadi perangkat dengan jam meleset tidak melihat hitungan
   * yang salah. Hook di sini (sebelum early return) — lihat J-14.
   *
   * Countdown auto-release dana: IN_DELIVERY + `autoCompleteAt` dari
   * backend. Fail closed: `autoCompleteAt` invalid → tidak tampil.
   */
  const autoReleaseAt = useMemo(() => {
    if (!order || order.status !== "IN_DELIVERY" || !order.autoCompleteAt) return null
    const target = new Date(order.autoCompleteAt).getTime()
    if (!Number.isFinite(target)) return null
    return order.autoCompleteAt
  }, [order])
  /**
   * Countdown "Batas waktu kirim penjual" — input mentah yang stabil;
   * tampil/sembunyi di-resolve per tick di dalam komponen countdown
   * (pola sama seperti auto-release di atas).
   */
  const shippingCountdownInput = useMemo<ShippingCountdownInput | null>(() => {
    if (!order || order.shippedBy || !order.shippingDeadline) return null
    return {
      status: order.status,
      paidAt: order.paidAt ?? null,
      shippingDeadline: order.shippingDeadline,
      shippedBy: order.shippedBy,
    }
  }, [order])
  const snoozeRatingReminderForOrder = useCallback(() => {
    if (!order) return
    // E-03: snooze dibandingkan terhadap jam SERVER (serverNow) di ui-prefs,
    // jadi penulisannya harus di domain yang sama.
    snoozeRatingReminder(order.id, serverNow() + RATING_SNOOZE_MS)
    toast.show({
      title: "Pengingat ulasan ditunda",
      description: "Pengingat muncul lagi di order ini dalam 3 hari.",
      tone: "info",
    })
  }, [order, toast.show])

  if (loading && !order) {
    return <OrderDetailSkeleton />
  }

  if (error && !order) {
    return (
      <Screen edges={["top"]}>
        <Header title="Detail Pesanan" />
        <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
      </Screen>
    )
  }

  if (!order) return null

  const myRole = order.myRole
  const knownRole = myRole === "BUYER" || myRole === "SELLER"
  const isSeller = myRole === "SELLER"
  const isBuyer = myRole === "BUYER"
  /**
   * Gerbang aksi mengikuti enum backend (WAITING_CONFIRMATION → WAITING_PAYMENT
   * → PROCESSING → IN_DELIVERY → COMPLETED), bukan nama lama hasil tebakan —
   * dengan status asli dari server keenam perbandingan lama SELALU false, jadi
   * layar ini tidak menampilkan satu pun tombol aksi: pembeli tidak bisa
   * membayar, penjual tidak bisa mengirim. Urutan endpoint di spec (create →
   * confirm → pay → …) memastikan `/confirm` (ACCEPT/REJECT) adalah giliran
   * PENJUAL sebelum pembeli membayar.
   *
   * EO-011 (audit 2026-09-26): cabang legacy `rawStatus === "PAID"` adalah
   * kode mati — enum backend OrderStatus tak punya PAID, jadi `rawStatus`
   * order tak pernah "PAID"; tombol "Mulai proses" tak pernah tampil.
   * Dibersihkan tanpa mengubah perilaku.
   */
  const canPay = (order.status === "WAITING_PAYMENT" || order.status === "PENDING_PAYMENT") && isBuyer
  const canConfirm = order.status === "WAITING_CONFIRMATION" && isSeller
  const canShip = order.status === "PROCESSING" && isSeller
  const canReviewDelivery =
    (order.status === "IN_DELIVERY" ||
      order.status === "SHIPPED" ||
      order.status === "DELIVERED") &&
    isBuyer
  // F6 (audit 2026-09-26): jangan tampilkan ajakan menilai bila user sudah menilai —
  // field `rated`/`isRated` sudah dinormalisasi dari payload order.
  const alreadyRated = order.rated === true || order.isRated === true
  // EO-009 (audit 2026-09-26): CTA rating hanya dalam jendela 7 hari backend
  // (isRatingWindowOpen; fail-closed bila completedAt hilang).
  const canRate = knownRole && order.status === "COMPLETED" && !alreadyRated && isRatingWindowOpen(order.completedAt)
  const ratingReminderVisible = canRate && !isRatingSnoozed(order.id)
  const canCancel = knownRole && isCancellable(order.status)
  const canDispute = knownRole && isDisputable(order.status)
  // EO-003 (audit 2026-09-26): perpanjangan tenggat HANYA seller
  // (backend: sellerId !== requesterId → 403).
  const canExtend = isSeller && isExtendable(order.status)
  const isDisputed = order.status === "DISPUTED"
  const cancelValid =
    Boolean(cancelReason.code) &&
    (cancelReason.code !== "OTHER" || cancelReason.note.trim().length > 0)
  const shippingRequired = order.orderType === "PHYSICAL_GOODS"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Pesanan" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {/* v2: konten detail reveal (fast) — key per order agar reveal terulang
            saat pindah order tanpa remount layar. Refresh (PTR) tidak memicu
            reveal ulang karena komponen tidak me-remount. */}
        <FadeIn key={order.id} duration="fast">
        {/* Iterasi de-card 2026-09-27: ritme antar-section space.8 (32px)
            sesuai §4 — section polos butuh ruang napas lebih lega
            dibanding tumpukan kartu. */}
        <View className="gap-7" style={{ paddingTop: tokens.space[3] }}>
          {/* 1 — Hero: status menonjol + judul + ID transaksi + tanggal/waktu.
              Hierarki baca: STATUS → JUDUL → ID TRANSAKSI → TANGGAL/WAKTU. */}
          <OrderStatusHero
            status={order.status}
            title={order.title}
            transactionId={order.id}
            createdAt={order.createdAt}
            role={isBuyer ? ("buyer" as const) : isSeller ? ("seller" as const) : undefined}
            copied={copied}
            onCopyId={() => void copy(order.id)}
          />

          {/* U5-013 (journey): banner escrow sekali-tampil untuk penjual. */}
          {isSeller && escrowBannerVisible ? (
            <SellerEscrowBanner onDismiss={dismissEscrowBanner} />
          ) : null}

          {!knownRole ? (
            <ErrorState
              compact
              title="Peran Anda belum terkonfirmasi"
              description="Aksi transaksi dinonaktifkan sampai peran Anda pada pesanan ini diketahui."
              onRetry={() => void query.reload()}
            />
          ) : null}

          {/* 2 — Perjalanan order: dibuat → dibayar (escrow) → dikirim →
              diterima → dana cair, masing-masing dengan timestamp. */}
          <OrderJourney steps={journeySteps} />

          {/* 3 — Aksi kontekstual sesuai status × peran (gerbang milik layar,
              komponen hanya me-render yang diminta). */}
          <OrderDetailActions
            canPay={canPay}
            canConfirm={canConfirm}
            canShip={canShip}
            canReviewDelivery={canReviewDelivery}
            canRate={canRate}
            canViewProof={
              !isBuyer &&
              (order.status === "IN_DELIVERY" ||
                order.status === "SHIPPED" ||
                order.status === "DELIVERED")
            }
            canReturnPrimary={query.data?.returnEligible === true}
            buyerPays={fee?.buyerPays}
            shippingRequired={shippingRequired}
            submitting={submitting}
            status={order.status}
            myRole={knownRole ? myRole : undefined}
            autoReleaseAt={autoReleaseAt}
            shippingCountdownInput={shippingCountdownInput}
            // Item 34: panduan "langkah berikutnya" dihitung di dalam
            // OrderDetailActions bila area aksi kosong.
            // Item 35: label countdown kontekstual ("Batas kirim"/"Batas konfirmasi").
            onPay={() => setSheet("pay")}
            onAccept={() => setConfirmAccept(true)}
            onReject={() => setSheet("reject")}
            onShipping={() => setSheet("shipping")}
            onDeliveryProof={() => router.push(ROUTES.deliveryProof(order.id))}
            // Item 32: rilis escrow WAJIB lewat dialog konfirmasi dulu.
            onComplete={() => setConfirmComplete(true)}
            onRate={() => router.push(ROUTES.rateOrder(order.id))}
            // Item 46: buka form retur dengan order terisi.
            onReturn={() => router.push(ROUTES.newReturn(order.id))}
            onReload={() => void query.reload()}
            // T2-009: tombol "Laporkan masalah" di kartu "Batas kirim" saat
            // penjual melewati tenggat — sheet sengketa yang sama.
            onDispute={
              isBuyer && canDispute && !isDisputed ? () => setSheet("dispute") : undefined
            }
          />

          {/* 4 — Pengingat ulasan (jendela 7 hari backend, bisa ditunda). */}
          <OrderRatingReminder
            visible={ratingReminderVisible}
            onRate={() => router.push(ROUTES.rateOrder(order.id))}
            onSnooze={snoozeRatingReminderForOrder}
          />

          {/* 5 — Produk */}
          <OrderProductCard
            title={order.title}
            description={order.description}
            orderType={order.orderType}
            orderValue={order.orderValue}
          />

          {/* 6 — Rincian pembayaran: tabel invoice sesungguhnya (bare, tanpa
              card) — baris + hairline divider, total menonjol. */}
          {fee && knownRole ? (
            <>
              <SectionHeader title="Rincian pembayaran" />
              <FeeBreakdown
                bare
                orderValue={order.orderValue}
                feeAmount={fee.platformFee}
                feeResponsibility={order.feeResponsibility}
                role={isBuyer ? "BUYER" : "SELLER"}
                discountAmount={fee.discount}
                // B-01: teruskan angka FINAL server — dulu kartu menghitung
                // ulang lokal sehingga angka kartu bisa berbeda dari tombol
                // "Bayar".
                buyerPays={fee.buyerPays}
                sellerGets={fee.sellerReceives}
                // T2-004: baris ongkir untuk barang fisik (tanpa mengubah total).
                showShippingNote={order.orderType === "PHYSICAL_GOODS"}
              />
            </>
          ) : null}

          {/* 7 — Pihak transaksi */}
          <OrderPartiesCard
            buyer={order.buyer}
            seller={order.seller}
            myRole={knownRole ? myRole : undefined}
            onOpenProfile={(username) => router.push(ROUTES.userProfile(username))}
          />

          {/* 8 — Pengiriman: kurir + resi (salin/lacak). Item 43: khusus
              PHYSICAL_GOODS — jasa/digital TIDAK menampilkan info kirim. */}
          {shippingRequired ? (
            <ShippingInfoCard
              shipping={
                order.trackingNumber || order.courierName
                  ? {
                      courierName: order.courierName ?? undefined,
                      trackingNumber: order.trackingNumber ?? undefined,
                    }
                  : null
              }
              canEdit={canShip}
              onEdit={() => setSheet("shipping")}
              onTrack={() => void openTracking()}
              onCopy={(v) => void copy(v)}
              copied={copied}
            />
          ) : null}

          {/* 9 — Dana escrow: penjelasan menenangkan sesuai status */}
          <OrderEscrowCard
            status={order.status}
            amount={fee?.buyerPays ?? order.orderValue}
            myRole={knownRole ? myRole : undefined}
            completedAt={order.completedAt}
            paidAt={order.paidAt}
          />

          {/* 10 — Info transaksi */}
          <SectionHeader title="Info transaksi" />
          <KeyValueList>
            <KeyValue
              label="Tenggat"
              value={
                order.deliveryDeadlineAt
                  ? formatDateTimeWIB(order.deliveryDeadlineAt)
                  : `${order.deliveryDeadlineDays} hari`
              }
            />
            {order.paidAt ? (
              <KeyValue label="Dibayar pada" value={formatDateTime(order.paidAt)} />
            ) : null}
            {order.completedAt ? (
              <KeyValue label="Diselesaikan pada" value={formatDateTime(order.completedAt)} />
            ) : null}
          </KeyValueList>

          {/* 11 — Bukti pembayaran — struk tiket. Hanya tampil bila order
              sudah dibayar (`paidAt` ada); logika order tidak diubah. */}
          {order.paidAt ? (
            <>
              <SectionHeader title="Bukti pembayaran" />
              <ReceiptTicket
                status={order.status === "CANCELLED" ? "REFUND" : "SUCCESS"}
                title={`Pembayaran pesanan #${shortId(order.id)}`}
                amount={fee?.buyerPays ?? order.orderValue}
                amountTone="success"
                rows={[
                  ...receiptDateRows(order.paidAt),
                ]}
                receiptId={order.id}
                qrDataUrl={orderPaymentQr}
                ticketRef={orderTicketRef}
                onShare={() => void shareReceipt(orderTicketRef.current)}
                // D12 (batch 139): salin ID REFERENSI saja — bukan data
                // sensitif lain. ID order dipakai sebagai referensi
                // pembayaran di perbankan/konfirmasi manual.
                onCopyReceiptId={(id) => void copy(id)}
              />
            </>
          ) : null}

          {/* 12 — Escrow bertahap (GAP-C): hanya tampil bila order punya
              milestone. Order satu tahap tidak berubah perilakunya. */}
          <MilestoneSection
            key={`milestones-${milestoneNonce}`}
            orderId={order.id}
            role={isBuyer ? "BUYER" : isSeller ? "SELLER" : undefined}
          />

          {/* 12b — Batch 43 (item 3): tawaran cicilan/DP oleh penjual,
              hanya sebelum order dibayar. */}
          {isSeller &&
          (order.status === "WAITING_PAYMENT" || order.status === "PENDING_PAYMENT") ? (
            <InstallmentOfferSection
              orderId={order.id}
              orderValueIdr={order.orderValue}
              onPlanCreated={() => setMilestoneNonce((n) => n + 1)}
            />
          ) : null}

          {/* 12c — Batch 43 (item 13): SPK ringan — teks kesepakatan +
              kedua pihak ketuk setuju. */}
          {isBuyer || isSeller ? (
            <OrderAgreementSection orderId={order.id} role={isSeller ? "SELLER" : "BUYER"} />
          ) : null}

          {/* 12d — Batch 43 (item 14): aset digital otomatis terbuka
              setelah bayar (server fail-closed bila belum). */}
          {order.orderType === "DIGITAL_GOODS" && order.showcaseId ? (
            <DigitalAssetsBuyerSection showcaseId={order.showcaseId} />
          ) : null}

          {/* 13 — Aksi sekunder */}
          <SectionHeader title="Lainnya" />
          {/*
           * FE-001 + T2-006: banner proaktif bila penjual melewati batas
           * kirim — detak terisolasi di dalam komponen ter-memo ini.
           */}
          <ShippingOverdueBanner
            input={shippingCountdownInput}
            visible={isBuyer && canDispute && !isDisputed}
            onOpenDispute={() => setSheet("dispute")}
          />
          <OrderSecondaryActions
            order={order}
            chatBusy={chatBusy}
            onOpenChat={() => void openChat()}
            canExtend={canExtend}
            isDisputed={isDisputed}
            canDispute={canDispute}
            canCancel={canCancel}
            canReturn={isBuyer && order.status === "COMPLETED"}
            returnIsPrimary={query.data?.returnEligible === true}
            submitting={submitting}
            onOpenSheet={(kind) => setSheet(kind)}
          />

          {/* 14 — Butuh bantuan? */}
          {/* Item 133: "Hubungi Bantuan Langsung" membuka form Buat Tiket dengan kategori
              ORDER + order terisi — bukan live support kosong. */}
          <OrderHelpCard
            onContactSupport={() =>
              router.push({
                pathname: "/contact",
                params: { category: "ORDER", orderId: order.id },
              })
            }
          />

          {/* 15 — Riwayat */}
          <SectionHeader title="Riwayat" />
          {history.length > 0 ? (
            <OrderHistoryTimeline
              entries={history.map((h) => ({
                id: h.id,
                toStatus: h.toStatus,
                fromStatus: h.fromStatus ?? undefined,
                actor: h.actorId ?? undefined,
                note: h.note ?? undefined,
                timestamp: formatDateTime(h.createdAt),
              }))}
              currentStatus={order.status}
              expectedNext={expectedNext}
            />
          ) : (
            <EmptyState
              compact
              icon={ClockCounterClockwise}
              title="Riwayat belum tersedia"
              description="Perubahan status pesanan akan tercatat di sini."
            />
          )}
          {historyHasMore ? (
            <View style={{ marginTop: tokens.space[3] }}>
              <Button
                variant="ghost"
                loading={historyLoadingMore}
                onPress={() => void loadMoreHistory()}
              >
                Muat lebih riwayat
              </Button>
            </View>
          ) : null}
        </View>
        </FadeIn>
      </PullToRefresh>

      {/* ── Bayar ─────────────────────────────────────────────── */}
      <OrderPaymentSheet
        open={sheet === "pay"}
        onClose={closeSheet}
        feeBuyerPays={fee?.buyerPays ?? null}
        payMethod={payMethod}
        onChangePayMethod={(v) => {
          // U5-011: pilihan eksplisit — auto-default tidak boleh menimpanya.
          payMethodTouchedRef.current = true
          setPayMethod(v)
          setPinError(undefined)
        }}
        submitting={submitting}
        pinError={pinError}
        // U5-010: banner inline "saldo kurang" + tombol "Isi Saldo".
        walletBalance={walletBalance}
        onTopup={handleTopupFromPay}
        onPayPin={(p) => void handlePayPin(p)}
        qrisPayment={qrisPayment}
        qrisStatus={qrisStatus}
        pollError={pollError}
        copied={copied}
        onCopy={(value) => void copy(value)}
        onRequestRecreate={() => setConfirmRecreateQris(true)}
        onUseOtherMethod={() => {
          // R2 (audit ronde-2, butir #29/#30): lepas intent QRIS aktif —
          // SegmentedControl terbuka lagi dan pengguna bisa pindah ke
          // saldo/PIN. Intent di server tetap terminal-sendiri bila
          // kedaluwarsa (reset hanya urusan klien).
          qrisPayment.reset()
          toast.show({
            title: "Silakan pilih metode pembayaran lain.",
            tone: "info",
            duration: 2500,
          })
        }}
        onShowQris={() => void handlePayQris()}
      />

      <OrderActionSheets
        sheet={
          sheet === "cancel" || sheet === "reject" || sheet === "dispute" || sheet === "shipping"
            ? sheet
            : null
        }
        onClose={closeSheet}
        order={order}
        submitting={submitting}
        cancelValid={cancelValid}
        cancelReason={cancelReason}
        onChangeCancelReason={setCancelReason}
        rejectReason={rejectReason}
        onChangeRejectReason={setRejectReason}
        disputeClaim={disputeClaim}
        onChangeDisputeClaim={setDisputeClaim}
        disputeCategory={disputeCategory}
        onChangeDisputeCategory={setDisputeCategory}
        tracking={tracking}
        onChangeTracking={setTracking}
        courier={courier}
        onChangeCourier={setCourier}
        shippingRequired={shippingRequired}
        runAction={runAction}
        noteMax={NOTE_MAX}
        disputeClaimMin={DISPUTE_CLAIM_MIN}
        disputeClaimMax={DISPUTE_CLAIM_MAX}
      />

      <OrderConfirmDialogs
        acceptOpen={confirmAccept}
        acceptLoading={submitting}
        onAcceptConfirm={() =>
          void runAction(
            () =>
              api.orders.confirmOrder(order.id, {
                action: "ACCEPT",
              }),
            "Order dikonfirmasi",
            "Gagal mengonfirmasi order",
          )
        }
        onAcceptClose={() => setConfirmAccept(false)}
        recreateOpen={confirmRecreateQris}
        recreateLoading={submitting || qrisCreating}
        onRecreateConfirm={() => {
          setConfirmRecreateQris(false)
          void handlePayQris()
        }}
        onRecreateClose={() => setConfirmRecreateQris(false)}
        completeOpen={confirmComplete}
        completeLoading={submitting}
        onCompleteConfirm={handleCompleteOrder}
        onCompleteClose={() => setConfirmComplete(false)}
        // TRX-020: nominal dana escrow yang dilepas ke penjual saat konfirmasi.
        // Pakai hitungan server (sellerReceives) bila ada, fallback ke nilai order.
        escrowAmount={fee?.sellerReceives ?? order.orderValue}
        // T2-008: blok nominal di dialog terima pesanan (penjual) — pakai
        // angka server; catatan beban biaya mengikuti feeResponsibility.
        acceptSellerAmount={fee?.sellerReceives}
        acceptFeeNote={
          order.feeResponsibility === "SELLER"
            ? "biaya layanan ditanggung penjual"
            : order.feeResponsibility === "SPLIT"
              ? "biaya layanan ditanggung bersama"
              : order.feeResponsibility === "BUYER"
                ? "biaya layanan ditanggung pembeli"
                : undefined
        }
      />

      <OrderPayProgressOverlay
        visible={payProgress !== null}
        state={payProgress ?? "PROCESSING"}
        feeBuyerPays={fee?.buyerPays}
        error={payProgressError}
      />

      {/*
       * D08 (batch 139): persetujuan ulang bila total berubah sejak layar
       * dibuka. "Lanjutkan" memakai PIN yang sudah dimasukkan (disimpan di
       * ref, tidak dirender); "Batal" = fail-closed, tidak ada pembayaran.
       */}
      <Dialog
        visible={priceChange != null}
        title="Total bayar berubah"
        description={
          priceChange
            ? `Total yang harus dibayar berubah dari ${formatRupiah(priceChange.oldTotal)} menjadi ${formatRupiah(priceChange.newTotal)} sejak Anda membuka halaman ini (perubahan biaya/diskon). Lanjutkan membayar dengan total terbaru?`
            : ""
        }
        confirmLabel={`Bayar ${priceChange ? formatRupiah(priceChange.newTotal) : ""}`}
        cancelLabel="Batal"
        onConfirm={() => {
          const pin = pendingPinRef.current
          pendingPinRef.current = null
          if (priceChange) acceptedTotalRef.current = priceChange.newTotal
          setPriceChange(null)
          // Refresh agar guard nominal & tampilan memakai angka terbaru.
          void query.refresh()
          if (pin) void handlePayPin(pin)
        }}
        onCancel={() => {
          pendingPinRef.current = null
          setPriceChange(null)
          void query.refresh()
        }}
        onRequestClose={() => {
          pendingPinRef.current = null
          setPriceChange(null)
        }}
      />
    </Screen>
  )
}
