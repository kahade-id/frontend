import { usePolling } from "@/lib/use-polling"
import { LoadingScreen } from "@/components/ui/loading-screen"
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
import {
  ChatCircleDots,
  Package,
  Receipt,
  ShieldWarning,
  Timer,
  Truck,
  UserCircle,
} from "phosphor-react-native"

import { api, isApiError, userMessage, type Order, type OrderStatus } from "@/lib/api"
import type { AverageDurations, CancelReason, QrisPayment } from "@/lib/api/orders"
import { useCopy } from "@/lib/clipboard"
import { formatDateTime, formatDecimal, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { FeeBreakdown } from "@/components/ui/fee-breakdown"
import { Field } from "@/components/ui/field"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { OrderHistoryTimeline } from "@/components/ui/order-history-timeline"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { PinInput } from "@/components/ui/pin-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { ReasonPicker, type ReasonOption, type ReasonValue } from "@/components/ui/reason-picker"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { ShippingInfoCard } from "@/components/ui/shipping-info-card"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const HISTORY_LIMIT = 50
const POLL_MS = 3000
const HOURS_PER_DAY = 24
const NOTE_MAX = 500
const DISPUTE_CLAIM_MIN = 20
const DISPUTE_CLAIM_MAX = 2000

/** Status yang masih bisa dibatalkan / disengketakan oleh salah satu pihak. */
const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
]
/** Sengketa hanya masuk akal setelah dana masuk escrow. */
const DISPUTABLE_STATUSES: readonly OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]
/** Perpanjangan tenggat hanya saat pekerjaan berjalan. */
const EXTENDABLE_STATUSES: readonly OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED"]

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu Pembayaran",
  PAID: "Dibayar",
  PROCESSING: "Diproses",
  SHIPPED: "Dikirim",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  DISPUTED: "Sengketa",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Dikembalikan",
  EXPIRED: "Kedaluwarsa",
}

/** Status berikutnya yang lazim, untuk estimasi durasi di timeline. */
const NEXT_STATUS: Partial<Record<string, OrderStatus>> = {
  PENDING_PAYMENT: "PAID",
  PAID: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: "COMPLETED",
}

const CANCEL_REASONS: readonly (ReasonOption & { code: CancelReason })[] = [
  { code: "CHANGED_MIND", label: "Berubah pikiran" },
  { code: "WRONG_DETAILS", label: "Detail pesanan salah" },
  { code: "DUPLICATE_ORDER", label: "Pesanan ganda" },
  { code: "MUTUAL_AGREEMENT", label: "Kesepakatan bersama" },
  { code: "COUNTERPART_UNRESPONSIVE", label: "Lawan transaksi tidak merespons" },
  { code: "OTHER", label: "Lainnya", other: true },
]

type PayMethod = "balance" | "qris"
const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: "balance", label: "Saldo Kahade" },
  { value: "qris", label: "QRIS" },
]

type SheetKind = "pay" | "cancel" | "reject" | "dispute" | "shipping" | null

function durationLabel(hours: number): string {
  if (hours >= HOURS_PER_DAY) return `Biasanya sekitar ${formatDecimal(hours / HOURS_PER_DAY)} hari`
  return `Biasanya sekitar ${formatDecimal(hours, 0)} jam`
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [history, setHistory] = useState<
    Awaited<ReturnType<typeof api.orders.getOrderHistory>>["data"]
  >([])
  const [fee, setFee] = useState<Awaited<ReturnType<typeof api.orders.calculateFee>> | null>(null)
  const [durations, setDurations] = useState<AverageDurations | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [confirmAccept, setConfirmAccept] = useState(false)

  // Pembayaran
  const [payMethod, setPayMethod] = useState<PayMethod>("balance")
  const [pinError, setPinError] = useState<string | undefined>()
  const [qris, setQris] = useState<QrisPayment | null>(null)
  const [qrisStatus, setQrisStatus] = useState<string | null>(null)
  const submitLock = useRef(false)
  const pollLock = useRef(false)
  const [pollError, setPollError] = useState<string | null>(null)
  const activePayment = useRef<string | null>(null)
  activePayment.current = sheet === "pay" && qris ? id : null

  // Alasan / form
  const [cancelReason, setCancelReason] = useState<ReasonValue>({ code: undefined, note: "" })
  const [rejectReason, setRejectReason] = useState("")
  const [disputeClaim, setDisputeClaim] = useState("")
  const [tracking, setTracking] = useState("")
  const [courier, setCourier] = useState("")

  const fetchOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [o, h, d] = await Promise.all([
        api.orders.getOrder(id),
        api.orders.getOrderHistory(id, { page: 1, limit: HISTORY_LIMIT }).catch(() => null),
        api.orders.getAverageDurations().catch(() => null),
      ])
      setOrder(o)
      setHistory(h?.data ?? [])
      setDurations(d)
      setFee(o.fee ?? null)
      setTracking(o.trackingNumber ?? "")
      setCourier(o.courierName ?? "")
      if (
        !o.fee &&
        (o.myRole === "BUYER" || o.myRole === "SELLER") &&
        ["PENDING_PAYMENT", "PAID"].includes(o.status)
      ) {
        try {
          setFee(
            await api.orders.calculateFee({
              orderValue: o.orderValue,
              feeResponsibility: o.feeResponsibility,
              role: o.myRole,
            }),
          )
        } catch {
          // fee opsional
        }
      }
    } catch (err) {
      setError(isApiError(err) ? userMessage(err) : "Gagal memuat detail order.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrder()
    setRefreshing(false)
  }, [fetchOrder])

  const closeSheet = useCallback(() => {
    setSheet(null)
    setPinError(undefined)
    setQris(null)
    setQrisStatus(null)
  }, [])

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
        await fetchOrder()
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
    [toast.show, closeSheet, fetchOrder],
  )

  const handlePayPin = useCallback(
    async (pin: string) => {
      if (!order || order.myRole !== "BUYER" || submitLock.current) return
      submitLock.current = true
      setSubmitting(true)
      setPinError(undefined)
      try {
        await api.orders.payOrder(order.id, { pin })
        toast.show({ title: "Pembayaran berhasil", tone: "success", duration: 3000 })
        closeSheet()
        await fetchOrder()
      } catch (err) {
        setPinError(isApiError(err) ? userMessage(err) : "PIN salah atau saldo tidak cukup.")
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [order, toast.show, closeSheet, fetchOrder],
  )

  const pollPayment = useCallback(async () => {
    if (!order || pollLock.current || activePayment.current !== order.id) return
    pollLock.current = true
    try {
      const res = await api.orders.getPaymentStatus(order.id)
      if (activePayment.current !== order.id) return
      setPollError(null)
      setQrisStatus(res.status)
      if (res.status === "PAID") {
        toast.show({ title: "Pembayaran QRIS diterima", tone: "success", duration: 3000 })
        closeSheet()
        await fetchOrder()
      }
    } catch (error) {
      if (activePayment.current === order.id) setPollError(userMessage(error))
    } finally {
      pollLock.current = false
    }
  }, [order, toast.show, closeSheet, fetchOrder])
  usePolling(
    pollPayment,
    POLL_MS,
    Boolean(
      qris &&
        sheet === "pay" &&
        !["PAID", "EXPIRED", "FAILED", "CANCELLED"].includes(qrisStatus ?? ""),
    ),
  )

  const handlePayQris = useCallback(async () => {
    if (!order || order.myRole !== "BUYER" || submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    try {
      const res = await api.orders.payOrderQris(order.id)
      setQris(res)
      setQrisStatus("PENDING")
    } catch (err) {
      toast.show({
        title: "Gagal membuat QRIS",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }, [order, toast.show])

  const openChat = useCallback(async () => {
    if (!order) return
    try {
      const rooms = await api.chat.listChatRooms()
      const room = rooms.find((r) => r.orderId === order.id)
      router.push(room ? ROUTES.chatRoom(room.id) : ROUTES.chat)
    } catch {
      router.push(ROUTES.chat)
    }
  }, [order])

  const expectedNext = useMemo(() => {
    if (!order) return undefined
    const next = NEXT_STATUS[order.status]
    if (!next) return undefined
    const hours = durations?.[next]
    return {
      title: STATUS_LABELS[next] ?? next,
      description: hours != null && hours > 0 ? durationLabel(hours) : undefined,
    }
  }, [order, durations])

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
        <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchOrder()} />
      </Screen>
    )
  }

  if (!order) return null

  const myRole = order.myRole
  const knownRole = myRole === "BUYER" || myRole === "SELLER"
  const isSeller = myRole === "SELLER"
  const isBuyer = myRole === "BUYER"
  const counterpart = isBuyer ? order.seller : isSeller ? order.buyer : undefined
  const canPay = order.status === "PENDING_PAYMENT" && isBuyer && !!fee
  const canConfirm = order.status === "PENDING_PAYMENT" && isSeller
  const canProcess = order.status === "PAID" && isSeller
  const canShip = order.status === "PROCESSING" && isSeller
  const canReviewDelivery = (order.status === "SHIPPED" || order.status === "DELIVERED") && isBuyer
  const canRate = knownRole && order.status === "COMPLETED"
  const canCancel = knownRole && ACTIVE_STATUSES.includes(order.status)
  const canDispute = knownRole && DISPUTABLE_STATUSES.includes(order.status)
  const canExtend = knownRole && EXTENDABLE_STATUSES.includes(order.status)
  const isDisputed = order.status === "DISPUTED"
  const cancelValid =
    Boolean(cancelReason.code) &&
    (cancelReason.code !== "OTHER" || cancelReason.note.trim().length > 0)
  const shippingRequired = order.orderType === "PHYSICAL_GOODS"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Order" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <View className="flex-row items-center justify-between">
            <Text variant="monoBody" tone="secondary" numberOfLines={1} className="flex-1 pr-3">
              {order.id}
            </Text>
            <OrderStatusBadge
              status={order.status}
              role={isBuyer ? "buyer" : isSeller ? "seller" : undefined}
              size="md"
              labels={STATUS_LABELS}
            />
          </View>

          {!knownRole ? (
            <Text variant="body" tone="secondary">
              Peran Anda belum terkonfirmasi. Aksi transaksi dinonaktifkan; muat ulang untuk
              memeriksa kembali.
            </Text>
          ) : null}
          <SectionHeader title={order.title} />
          <Text variant="body" tone="secondary">
            {order.description}
          </Text>

          <KeyValueList>
            <KeyValue
              label="Nilai transaksi"
              value={<Text variant="monoBody">{formatRupiah(order.orderValue)}</Text>}
              emphasis
            />
            <KeyValue
              label={isBuyer ? "Penjual" : isSeller ? "Pembeli" : "Lawan transaksi"}
              value={
                <Button
                  disabled={!counterpart}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  leftIcon={UserCircle}
                  onPress={() =>
                    counterpart && router.push(ROUTES.userProfile(counterpart.username))
                  }
                >
                  {counterpart ? `@${counterpart.username}` : "Identitas belum tersedia"}
                </Button>
              }
            />
            <KeyValue
              label="Tenggat"
              value={
                order.deliveryDeadlineAt
                  ? formatDateTime(order.deliveryDeadlineAt)
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

          {/* ── Aksi utama sesuai status ─────────────────────────── */}
          <View className="gap-2">
            {canPay ? (
              <Button onPress={() => setSheet("pay")}>
                Bayar {formatRupiah(fee?.buyerPays ?? order.orderValue)}
              </Button>
            ) : null}
            {canConfirm ? (
              <>
                <Button onPress={() => setConfirmAccept(true)}>Terima Order</Button>
                <Button variant="secondary" onPress={() => setSheet("reject")}>
                  Tolak Order
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
                Mulai Proses
              </Button>
            ) : null}
            {canShip ? (
              <>
                <Button leftIcon={Truck} onPress={() => setSheet("shipping")}>
                  {shippingRequired ? "Isi Resi Pengiriman" : "Tandai Dikirim"}
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={Package}
                  onPress={() => router.push(ROUTES.deliveryProof(order.id))}
                >
                  Unggah Bukti Pengiriman
                </Button>
              </>
            ) : null}
            {canReviewDelivery ? (
              <>
                <Button
                  leftIcon={Package}
                  onPress={() => router.push(ROUTES.deliveryProof(order.id))}
                >
                  Periksa Bukti Pengiriman
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
                  Tandai Selesai
                </Button>
              </>
            ) : null}
            {!isBuyer && (order.status === "SHIPPED" || order.status === "DELIVERED") ? (
              <Button
                variant="secondary"
                leftIcon={Package}
                onPress={() => router.push(ROUTES.deliveryProof(order.id))}
              >
                Bukti Pengiriman
              </Button>
            ) : null}
            {canRate ? (
              <Button variant="secondary" onPress={() => router.push(ROUTES.rateOrder(order.id))}>
                Beri Ulasan
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
                Perpanjang Tenggat
              </Button>
            ) : null}
            {isDisputed ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={ShieldWarning}
                onPress={() => router.push(ROUTES.disputes)}
              >
                Lihat Sengketa
              </Button>
            ) : canDispute ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={ShieldWarning}
                onPress={() => setSheet("dispute")}
              >
                Ajukan Sengketa
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setSheet("cancel")}
                disabled={submitting}
              >
                Batalkan Order
              </Button>
            ) : null}
          </View>

          {history.length > 0 ? (
            <>
              <SectionHeader title="Riwayat" />
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
            </>
          ) : null}
        </View>
      </PullToRefresh>

      {/* ── Bayar ─────────────────────────────────────────────── */}
      <BottomSheet
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
            value={payMethod}
            onChange={(v) => {
              setPayMethod(v)
              setPinError(undefined)
            }}
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
            <>
              {pollError ? (
                <Text variant="caption" tone="danger">
                  Status belum diperbarui: {pollError}
                </Text>
              ) : null}
              <QRCodeDisplay
                value={qris.qrString}
                title="Pindai dengan aplikasi pembayaran"
                caption={`Berlaku sampai ${formatDateTime(qris.expiresAt)} · ${formatRupiah(qris.amount)}`}
                onCopy={(v) => void copy(v)}
                copied={copied}
              />
              <Text
                variant="caption"
                tone={qrisStatus === "EXPIRED" || qrisStatus === "FAILED" ? "danger" : "secondary"}
              >
                {qrisStatus === "EXPIRED"
                  ? "QRIS kedaluwarsa — buat ulang untuk mencoba lagi."
                  : qrisStatus === "FAILED"
                    ? "Pembayaran gagal — buat ulang untuk mencoba lagi."
                    : "Menunggu pembayaran… status diperbarui otomatis."}
              </Text>
              {qrisStatus === "EXPIRED" || qrisStatus === "FAILED" ? (
                <Button
                  variant="secondary"
                  loading={submitting}
                  onPress={() => void handlePayQris()}
                >
                  Buat Ulang QRIS
                </Button>
              ) : (
                <Button variant="ghost" onPress={() => void pollPayment()}>
                  Cek Status Sekarang
                </Button>
              )}
            </>
          ) : (
            <Button loading={submitting} onPress={() => void handlePayQris()}>
              Tampilkan Kode QRIS
            </Button>
          )}
        </View>
      </BottomSheet>

      {/* ── Batalkan ──────────────────────────────────────────── */}
      <BottomSheet
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
            Batalkan Order
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
            Tolak Order
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
        visible={sheet === "dispute"}
        onRequestClose={closeSheet}
        title="Ajukan sengketa"
        description="Dana escrow dibekukan sampai mediator Kahade memutuskan. Bukti foto bisa ditambahkan setelah sengketa dibuat."
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            disabled={disputeClaim.trim().length < DISPUTE_CLAIM_MIN}
            onPress={() =>
              void runAction(
                () => api.orders.submitDispute(order.id, { claim: disputeClaim.trim() }),
                "Sengketa dibuka",
                "Gagal membuka sengketa",
              )
            }
          >
            Buka Sengketa
          </Button>
        }
      >
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
    </Screen>
  )
}
