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

import { LoadingScreen } from "@/components/ui/loading-screen"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ChatCircleDots,
  ClockCounterClockwise,
  Package,
  Receipt,
  ShieldWarning,
  Timer,
  Truck,
} from "phosphor-react-native"

import { api, isApiError, userMessage, type Order, type SubmitDisputeDto } from "@/lib/api"
import { normalizeOrder } from "@/lib/api/orders"
import {
  getAverageDurationsCached,
  isCancellable,
  isDisputable,
  isExtendable,
  nextOrderStatus,
  type AverageDurations,
  type CancelReason,
} from "@/lib/api/orders"
import { RATING_SNOOZE_MS, isRatingSnoozed, snoozeRatingReminder, useUiPrefs } from "@/lib/ui-prefs"
import { useQrisPayment } from "@/lib/use-qris-payment"
import { useResultTimer } from "@/lib/use-result-timer"
import {
  CANCEL_REASONS,
  DISPUTE_CATEGORIES,
  type DisputeCategoryValue,
} from "@/lib/labels/dispute"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { useCopy } from "@/lib/clipboard"
import {
  durationHoursParts,
  formatDateTime,
  formatDateTimeWIB,
  formatRupiah,
} from "@/lib/format"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FeeBreakdown } from "@/components/ui/fee-breakdown"
import { FadeIn } from "@/components/ui/fade-in"
import { Field } from "@/components/ui/field"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { OrderHistoryTimeline } from "@/components/ui/order-history-timeline"
import { ORDER_STATUS_LABELS, OrderStatusBadge } from "@/components/ui/order-status-badge"
import { PinInput } from "@/components/ui/pin-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QrisPaymentPanel } from "@/components/qris-payment-panel"
import { ReasonPicker, type ReasonValue } from "@/components/ui/reason-picker"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Screen } from "@/components/ui/screen"
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { ShippingInfoCard } from "@/components/ui/shipping-info-card"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"

const HISTORY_LIMIT = 50

const NOTE_MAX = 500
const DISPUTE_CLAIM_MIN = 20
const DISPUTE_CLAIM_MAX = 2000
// G-12 (audit): kategori sengketa & alasan batal kini dari lib/labels/dispute
// (satu sumber, ditipe dari DTO yang di-generate).

type PayMethod = "balance" | "qris"
const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: "balance", label: "Saldo Kahade" },
  { value: "qris", label: "QRIS" },
]

type SheetKind = "pay" | "cancel" | "reject" | "dispute" | "shipping" | null

/** Status yang masih butuh rincian biaya dihitung ulang (belum final). */
const EARLY_STATUSES: readonly string[] = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PROCESSING",
  "PENDING_PAYMENT",
  "PAID",
]

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

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
    durations: AverageDurations | null
    fee: Awaited<ReturnType<typeof api.orders.calculateFee>> | null
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
      const role =
        o.myRole ??
        (me?.id && o.buyer?.id === me.id
          ? "BUYER"
          : me?.id && o.seller?.id === me.id
            ? "SELLER"
            : me?.username && o.buyer?.username === me.username
              ? "BUYER"
              : me?.username && o.seller?.username === me.username
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
            },
            signal,
          )
        } catch {
          // fee opsional
        }
      }
      return { order: resolvedOrder, history: h?.data ?? [], durations: d, fee }
    },
    Boolean(id),
  )
  const order = query.data?.order ?? null
  const history = query.data?.history ?? []
  const durations = query.data?.durations ?? null
  const fee = query.data?.fee ?? null
  const { loading, error, refreshing } = query
  const [submitting, setSubmitting] = useState(false)

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [confirmAccept, setConfirmAccept] = useState(false)

  // Pembayaran
  const [payMethod, setPayMethod] = useState<PayMethod>("balance")
  const [pinError, setPinError] = useState<string | undefined>()
  // Overlay progres saat membayar escrow dari saldo (PIN disubmit).
  const [payProgress, setPayProgress] = useState<"PROCESSING" | "SUCCESS" | "FAILURE" | null>(null)
  const [payProgressError, setPayProgressError] = useState<string | undefined>()

  // A-03 (audit): tombol biometrik DIHAPUS dari sheet pembayaran escrow —
  // PayOrderDto mewajibkan `pin` mentah dan tidak ada jalur backend
  // "biometrik → tiket konfirmasi", jadi prompt biometrik yang "sukses"
  // tidak pernah mengirim apa pun. Biometrik hidup di kunci aplikasi
  // (components/app-lock-gate.tsx), bukan di konfirmasi dana.
  const scheduleResult = useResultTimer()

  const submitLock = useRef(false)

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
  const { qris, status: qrisStatus, pollError, stopped: qrisPollStopped, creating: qrisCreating } = qrisPayment

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
    qrisPayment.reset()
  }, [qrisPayment])

  /** Pembungkus aksi sederhana: loading, toast sukses/gagal, refetch. */
  const runAction = useCallback(
    async (fn: () => Promise<unknown>, success: string, failure: string) => {
      if (submitLock.current) return false
      submitLock.current = true
      setSubmitting(true)
      try {
        await fn()
        toast.show({ title: success, tone: "success", duration: 3000 })
        closeSheet()
        setConfirmAccept(false)
        await query.refresh()
        return true
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
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      setPayProgressError(undefined)
      setPayProgress("PROCESSING")
      try {
        await api.orders.payOrder(order.id, { pin })
        setPayProgress("SUCCESS")
        scheduleResult(() => {
          setPayProgress(null)
          closeSheet()
          void query.refresh()
        })
      } catch (err) {
        /*
         * A-15 (audit 2026-09-22): timeout/jaringan berarti debit MUNGKIN sudah
         * terjadi. Versi lama hanya menampilkan pesan kegagalan lalu membuka
         * sheet PIN lagi — pengguna menekan bayar ulang tanpa tahu state
         * sebenarnya, dan `Idempotency-Key` baru dibuat untuk percobaan itu.
         * Sekarang kegagalan tak pasti memicu penyegaran data order supaya
         * status yang terlihat berasal dari server, bukan asumsi.
         */
        const uncertain = !isApiError(err) || err.isTransient || err.code === "ABORTED"
        const base = isApiError(err) ? userMessage(err) : "PIN salah atau saldo tidak cukup."
        const msg = uncertain
          ? `${base} Status pembayaran mungkin sudah diproses — memuat ulang status…`
          : base
        setPayProgressError(msg)
        setPayProgress("FAILURE")
        if (uncertain) {
          invalidateQueryCache()
          void query.refresh()
        }
        scheduleResult(() => {
          setPayProgress(null)
          setPinError(msg)
        })
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [order, closeSheet, query, scheduleResult],
  )

  /**
   * Pembeli memilih "Tampilkan kode QRIS" / "Buat ulang QRIS". Seluruh logika
   * (guard intent ganda, cap polling, rekonsiliasi kegagalan tak pasti) ada di
   * lib/use-qris-payment.ts.
   */
  const handlePayQris = useCallback(() => qrisPayment.createIntent(), [qrisPayment])

  const openChat = useCallback(async () => {
    if (!order) return
    try {
      const rooms = await api.chat.listChatRooms()
      const room = rooms.data.find((r) => r.orderId === order.id)
      router.push(
        room
          ? ROUTES.chatRoom(room.id, room.counterpart?.fullName ?? undefined)
          : ROUTES.chat,
      )
    } catch {
      router.push(ROUTES.chat)
    }
  }, [order])

  const expectedNext = useMemo(() => {
    if (!order) return undefined
    const next = nextOrderStatus(order.status)
    if (!next) return undefined
    const hours = durations?.[next]
    // G-05: frasa diterjemahkan lewat kunci berkatalog ({x} = angkanya), bukan
    // kalimat Indonesia yang dirakit di lapisan format.
    const parts = hours != null ? durationHoursParts(hours) : null
    return {
      title: ORDER_STATUS_LABELS[next] ?? next,
      description: !parts
        ? undefined
        : parts.unit === "hari"
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
  useUiPrefs()
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
    return (
      <Screen edges={["top"]}>
        <Header title="Detail Order" />
        <LoadingScreen message="Memuat order…" />
      </Screen>
    )
  }

  if (error && !order) {
    return (
      <Screen edges={["top"]}>
        <Header title="Detail Order" />
        <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
      </Screen>
    )
  }

  if (!order) return null

  const myRole = order.myRole
  const knownRole = myRole === "BUYER" || myRole === "SELLER"
  const isSeller = myRole === "SELLER"
  const isBuyer = myRole === "BUYER"
  const counterpart = isBuyer ? order.seller : isSeller ? order.buyer : undefined
  /**
   * Gerbang aksi mengikuti enum backend (WAITING_CONFIRMATION → WAITING_PAYMENT
   * → PROCESSING → IN_DELIVERY → COMPLETED), bukan nama lama hasil tebakan —
   * dengan status asli dari server keenam perbandingan lama SELALU false, jadi
   * layar ini tidak menampilkan satu pun tombol aksi: pembeli tidak bisa
   * membayar, penjual tidak bisa mengirim. Urutan endpoint di spec (create →
   * confirm → pay → …) memastikan `/confirm` (ACCEPT/REJECT) adalah giliran
   * PENJUAL sebelum pembeli membayar.
   *
   * `canProcess` sengaja hanya mengenali alias lama PAID: enum backend tidak
   * punya status itu (pembayaran menggeser WAITING_PAYMENT langsung ke
   * PROCESSING), dan menampilkan "Mulai proses" sebelum pembeli membayar akan
   * menawarkan aksi yang salah.
   */
  const canPay = (order.status === "WAITING_PAYMENT" || order.status === "PENDING_PAYMENT") && isBuyer
  const canConfirm = order.status === "WAITING_CONFIRMATION" && isSeller
  const canProcess = order.status === "PAID" && isSeller
  const canShip = order.status === "PROCESSING" && isSeller
  const canReviewDelivery =
    (order.status === "IN_DELIVERY" ||
      order.status === "SHIPPED" ||
      order.status === "DELIVERED") &&
    isBuyer
  const canRate = knownRole && order.status === "COMPLETED"
  const ratingReminderVisible = canRate && !isRatingSnoozed(order.id)
  const canCancel = knownRole && isCancellable(order.status)
  const canDispute = knownRole && isDisputable(order.status)
  const canExtend = knownRole && isExtendable(order.status)
  const isDisputed = order.status === "DISPUTED"
  const cancelValid =
    Boolean(cancelReason.code) &&
    (cancelReason.code !== "OTHER" || cancelReason.note.trim().length > 0)
  const shippingRequired = order.orderType === "PHYSICAL_GOODS"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Order" />
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
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          {/*
           * Urutan baca (audit komposisi): STATUS -> JUDUL -> deskripsi -> ID.
           * Sebelumnya baris pertama layar adalah ID order (monoBody 14px,
           * tone secondary) sementara judul order baru muncul dua blok di
           * bawah — elemen paling tidak penting mendapat posisi paling
           * menonjol. ID dipindah ke bawah deskripsi sebagai caption; badge
           * status naik ke baris judul karena itulah yang dicari user saat
           * membuka layar ini.
           */}
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text variant="h2" numberOfLines={3}>
                {order.title}
              </Text>
            </View>
            <OrderStatusBadge
              status={order.status}
              role={isBuyer ? "buyer" : isSeller ? "seller" : undefined}
              size="md"
            />
          </View>

          {!knownRole ? (
            <ErrorState
              compact
              title="Peran Anda belum terkonfirmasi"
              description="Aksi transaksi dinonaktifkan sampai peran Anda pada order ini diketahui."
              onRetry={() => void query.reload()}
            />
          ) : null}

          <Text variant="body" tone="secondary">
            {order.description}
          </Text>

          <Text variant="monoBody" tone="tertiary" numberOfLines={1} selectable>
            {order.id}
          </Text>

          <KeyValueList>
            <KeyValue
              label="Nilai transaksi"
              value={<Text variant="monoBody">{formatRupiah(order.orderValue)}</Text>}
              emphasis
            />
            {/*
             * Sebelumnya <Button variant="ghost"> dipakai sebagai NILAI baris:
             * tinggi 40px + padding tombol membuat baris ini melompat keluar
             * irama KeyValueList, dan secara hierarki tombol (aksi) menyaingi
             * "Nilai transaksi" di atasnya. Navigasi ke profil = navigasi
             * dalam konteks teks -> <TextLink> (§2.3 link = primary +
             * underline). Tanpa counterpart, nilainya jadi teks biasa.
             */}
            <KeyValue
              label={isBuyer ? "Penjual" : isSeller ? "Pembeli" : "Lawan transaksi"}
              value={
                counterpart ? (
                  <TextLink
                    onPress={() => router.push(ROUTES.userProfile(counterpart.username))}
                    accessibilityLabel={translate("Lihat profil @{x}", { x: counterpart.username })}
                  >
                    {`@${counterpart.username}`}
                  </TextLink>
                ) : (
                  <Text variant="body" tone="tertiary">
                    Identitas belum tersedia
                  </Text>
                )
              }
            />
            <KeyValue
              label="Tenggat"
              value={
                order.deliveryDeadlineAt
                  ? formatDateTimeWIB(order.deliveryDeadlineAt)
                  : `${order.deliveryDeadlineDays} hari`
              }
            />
            <KeyValue label="Dibuat" value={formatDateTime(order.createdAt)} />
          </KeyValueList>

          {fee && knownRole ? (
            <FeeBreakdown
              orderValue={order.orderValue}
              feeAmount={fee.platformFee}
              feeResponsibility={order.feeResponsibility}
              role={isBuyer ? "BUYER" : "SELLER"}
              discountAmount={fee.discount}
            />
          ) : null}

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
            onCopy={(v) => void copy(v)}
            copied={copied}
          />

          {ratingReminderVisible ? (
            <View className="gap-3 rounded-lg bg-info-soft p-3">
              <Text variant="caption" tone="secondary">
                Transaksi selesai — ulasanmu membantu pengguna lain memutuskan.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button size="sm" onPress={() => router.push(ROUTES.rateOrder(order.id))}>
                  Ulas sekarang
                </Button>
                <Button size="sm" variant="ghost" onPress={snoozeRatingReminderForOrder}>
                  Ingatkan nanti
                </Button>
              </View>
            </View>
          ) : null}

          {/* ── Aksi utama sesuai status ─────────────────────────── */}
          <View className="gap-2">
            {canPay ? (
              <>
                {!fee ? (
                  <ErrorState
                    compact
                    title="Rincian biaya belum tersedia"
                    description="Muat ulang untuk menampilkan jumlah yang harus dibayar."
                    onRetry={() => void query.reload()}
                  />
                ) : null}
                <Button disabled={!fee} onPress={() => setSheet("pay")}>
                  Bayar {formatRupiah(fee?.buyerPays ?? order.orderValue)}
                </Button>
              </>
            ) : null}
            {canConfirm ? (
              <>
                <Button onPress={() => setConfirmAccept(true)}>Terima pesanan</Button>
                <Button variant="secondary" onPress={() => setSheet("reject")}>
                  Tolak pesanan
                </Button>
              </>
            ) : null}
            {canProcess ? (
              <Button
                loading={submitting}
                onPress={() =>
                  void runAction(
                    () => api.orders.processOrder(order.id),
                    "Order mulai diproses",
                    "Gagal memproses order",
                  )
                }
              >
                Mulai proses
              </Button>
            ) : null}
            {canShip ? (
              <>
                <Button leftIcon={Truck} onPress={() => setSheet("shipping")}>
                  {shippingRequired ? "Isi resi pengiriman" : "Tandai dikirim"}
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={Package}
                  onPress={() => router.push(ROUTES.deliveryProof(order.id))}
                >
                  Unggah bukti pengiriman
                </Button>
              </>
            ) : null}
            {canReviewDelivery ? (
              <>
                <Button
                  leftIcon={Package}
                  onPress={() => router.push(ROUTES.deliveryProof(order.id))}
                >
                  Periksa bukti pengiriman
                </Button>
                <Button
                  variant="secondary"
                  loading={submitting}
                  onPress={() =>
                    void runAction(
                      () => api.orders.completeOrder(order.id),
                      "Order selesai",
                      "Gagal menyelesaikan order",
                    )
                  }
                >
                  Tandai selesai
                </Button>
              </>
            ) : null}
            {!isBuyer &&
            (order.status === "IN_DELIVERY" ||
              order.status === "SHIPPED" ||
              order.status === "DELIVERED") ? (
              <Button
                variant="secondary"
                leftIcon={Package}
                onPress={() => router.push(ROUTES.deliveryProof(order.id))}
              >
                Bukti pengiriman
              </Button>
            ) : null}
            {canRate ? (
              <Button variant="secondary" onPress={() => router.push(ROUTES.rateOrder(order.id))}>
                Beri ulasan
              </Button>
            ) : null}
          </View>

          {/* ── Aksi sekunder ────────────────────────────────────── */}
          <SectionHeader title="Lainnya" />
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={Receipt}
              onPress={() => router.push(ROUTES.invoice(order.id))}
            >
              Invoice
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={ChatCircleDots}
              onPress={() => void openChat()}
            >
              Chat
            </Button>
            {canExtend ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={Timer}
                onPress={() => router.push(ROUTES.extension(order.id))}
              >
                Perpanjang tenggat
              </Button>
            ) : null}
            {isDisputed ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={ShieldWarning}
                onPress={() => router.push(ROUTES.disputes)}
              >
                Lihat sengketa
              </Button>
            ) : canDispute ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={ShieldWarning}
                onPress={() => setSheet("dispute")}
              >
                Ajukan sengketa
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setSheet("cancel")}
                disabled={submitting}
              >
                Batalkan pesanan
              </Button>
            ) : null}
          </View>

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
            // Sebelumnya <Text> polos — satu-satunya "kosong" di layar ini
            // yang tidak memakai bentuk EmptyState seperti layar lain.
            <EmptyState
              compact
              icon={ClockCounterClockwise}
              title="Riwayat belum tersedia"
              description="Perubahan status order akan tercatat di sini."
            />
          )}
        </View>
        </FadeIn>
      </PullToRefresh>

      {/* ── Bayar ─────────────────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "pay"}
        onRequestClose={closeSheet}
        title="Pembayaran"
        description={
          fee?.buyerPays != null
            ? `Total ${formatRupiah(fee.buyerPays)} masuk ke escrow Kahade.`
            : "Total pembayaran belum terkonfirmasi. Muat ulang rincian biaya sebelum membayar."
        }
      >
        <View className="gap-4">
          <SegmentedControl<PayMethod>
            items={PAY_METHODS}
            accessibilityLabel="Metode pembayaran"
            value={payMethod}
            onChange={(v) => { setPayMethod(v); setPinError(undefined) }}
            disabled={submitting || qris != null}
          />
          {payMethod === "balance" ? (
            <>
              <Text variant="body" tone="secondary">
                Masukkan PIN dompet untuk membayar dari saldo Kahade.
              </Text>
              <PinInput
                mode="enter"
                onComplete={(p) => void handlePayPin(p)}
                errorText={pinError}
                disabled={submitting}
              />
            </>
          ) : qris ? (
            /* Panel QRIS diekstrak ke components/qris-payment-panel.tsx (S9):
               state & mutasi tetap di layar ini, panel hanya presentasi. */
            <QrisPaymentPanel
              qrString={qris.qrString}
              amount={qris.amount}
              expiresAt={qris.expiresAt}
              status={qrisStatus}
              pollError={pollError}
              pollStopped={qrisPollStopped}
              submitting={submitting || qrisCreating}
              copied={copied}
              onCopy={(value) => void copy(value)}
              onExpire={qrisPayment.expireLocally}
              onRecreate={() => void handlePayQris()}
              onCheckStatus={() => void qrisPayment.syncStatus()}
            />
          ) : (
            <Button loading={submitting || qrisCreating} onPress={() => void handlePayQris()}>
              Tampilkan kode QRIS
            </Button>
          )}
        </View>
      </BottomSheet>

      {/* ── Batalkan ──────────────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "cancel"}
        onRequestClose={closeSheet}
        title="Batalkan order?"
        description="Order akan dibatalkan dan dana yang sudah masuk dikembalikan ke pembeli."
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            disabled={!cancelValid}
            onPress={() =>
              void runAction(
                () =>
                  api.orders.cancelOrder(order.id, {
                    reason: cancelReason.code as CancelReason,
                    note: cancelReason.note.trim() || undefined,
                  }),
                "Order dibatalkan",
                "Gagal membatalkan order",
              )
            }
          >
            Batalkan pesanan
          </Button>
        }
      >
        <ReasonPicker
          options={CANCEL_REASONS}
          value={cancelReason}
          onChange={setCancelReason}
          noteMaxLength={NOTE_MAX}
          disabled={submitting}
        />
      </BottomSheet>

      {/* ── Tolak (penjual) ───────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "reject"}
        onRequestClose={closeSheet}
        title="Tolak order?"
        description="Pembeli akan diberi tahu beserta alasan Anda."
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            onPress={() =>
              void runAction(
                () =>
                  api.orders.confirmOrder(order.id, {
                    action: "REJECT",
                    reason: rejectReason.trim() || undefined,
                  }),
                "Order ditolak",
                "Gagal menolak order",
              )
            }
          >
            Tolak pesanan
          </Button>
        }
      >
        <TextArea
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Alasan penolakan (opsional)"
          maxLength={NOTE_MAX}
          multiline
          numberOfLines={3}
        />
      </BottomSheet>

      {/* ── Sengketa ──────────────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "dispute"}
        onRequestClose={closeSheet}
        title="Ajukan sengketa"
        description="Dana escrow dibekukan sampai mediator Kahade memutuskan. Bukti foto bisa ditambahkan setelah sengketa dibuat."
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            disabled={disputeClaim.trim().length < DISPUTE_CLAIM_MIN || !disputeCategory}
            onPress={() =>
              void runAction(
                () =>
                  api.orders.submitDispute(order.id, {
                    claim: disputeClaim.trim(),
                    category: disputeCategory as SubmitDisputeDto["category"],
                  }),
                "Sengketa dibuka",
                "Gagal membuka sengketa",
              )
            }
          >
            Buka sengketa
          </Button>
        }
      >
        <Field label="Kategori" required>
          <RadioGroup
            accessibilityLabel="Kategori sengketa"
            value={disputeCategory}
            onChange={(v) => setDisputeCategory(v as DisputeCategoryValue)}
            variant="plain"
          >
            {DISPUTE_CATEGORIES.map((c) => (
              <Radio key={c.value} value={c.value} label={c.label} />
            ))}
          </RadioGroup>
        </Field>
        <Field
          label="Klaim Anda"
          required
          helperText={`Minimal ${DISPUTE_CLAIM_MIN} karakter — jelaskan apa yang tidak sesuai.`}
        >
          <TextArea
            value={disputeClaim}
            onChangeText={setDisputeClaim}
            placeholder="Barang tidak sesuai deskripsi karena…"
            maxLength={DISPUTE_CLAIM_MAX}
            multiline
            numberOfLines={5}
          />
        </Field>
      </BottomSheet>

      {/* ── Resi / kirim (penjual) ────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "shipping"}
        onRequestClose={closeSheet}
        title={shippingRequired ? "Info pengiriman" : "Tandai dikirim"}
        description={
          shippingRequired
            ? "Nomor resi & kurir wajib untuk barang fisik."
            : "Untuk jasa/digital, resi opsional — pembeli akan diminta memeriksa hasil."
        }
        footer={
          <Button
            fullWidth
            loading={submitting}
            disabled={shippingRequired && (tracking.trim().length < 3 || courier.trim().length < 2)}
            onPress={() =>
              void runAction(
                () =>
                  api.orders.updateShipping(order.id, {
                    trackingNumber: tracking.trim() || undefined,
                    courierName: courier.trim() || undefined,
                  }),
                "Info pengiriman disimpan",
                "Gagal menyimpan info pengiriman",
              )
            }
          >
            Simpan
          </Button>
        }
      >
        <View className="gap-4">
          <Field label="Kurir" required={shippingRequired}>
            <Input
              value={courier}
              onChangeText={setCourier}
              placeholder="JNE, SiCepat, …"
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={100}
            />
          </Field>
          <Field label="Nomor resi" required={shippingRequired}>
            <Input
              value={tracking}
              onChangeText={setTracking}
              placeholder="Nomor resi"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              maxLength={100}
            />
          </Field>
        </View>
      </BottomSheet>

      <Dialog
        title="Terima order ini?"
        description="Anda akan melanjutkan proses penyelesaian pesanan ini setelah pembeli membayar."
        visible={confirmAccept}
        loading={submitting}
        confirmLabel="Terima"
        cancelLabel="Tutup"
        onConfirm={() =>
          void runAction(
            () => api.orders.confirmOrder(order.id, { action: "ACCEPT" }),
            "Order dikonfirmasi",
            "Gagal mengonfirmasi order",
          )
        }
        onCancel={() => setConfirmAccept(false)}
        onRequestClose={() => setConfirmAccept(false)}
      />

      {/* Progres pembayaran escrow full-screen (PIN disubmit, §8 signature) */}
      <TransactionProgressOverlay
        visible={payProgress !== null}
        state={payProgress ?? "PROCESSING"}
        processingMessage={`Membayar ${formatRupiah(fee?.buyerPays ?? 0)} dari saldo…`}
        successMessage="Pembayaran berhasil"
        failureMessage={payProgressError ?? "Pembayaran gagal. Coba lagi."}
      />
    </Screen>
  )
}
