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
  ClockCounterClockwise,
  Package,
  Truck,
} from "phosphor-react-native"

import { api, isApiError, userMessage, type Order } from "@/lib/api"
import { createIdempotencyKey } from "@/lib/api/client"
import { normalizeOrder } from "@/lib/api/orders"
import {
  getAverageDurationsCached,
  isCancellable,
  isDisputable,
  isExtendable,
  nextOrderStatus,
  type AverageDurations,
} from "@/lib/api/orders"
import { RATING_SNOOZE_MS, isRatingSnoozed, snoozeRatingReminder, useUiPrefs } from "@/lib/ui-prefs"
import { usePolling } from "@/lib/use-polling"
import { useClockTick } from "@/lib/use-clock-tick"
import { useQrisPayment } from "@/lib/use-qris-payment"
import { useResultTimer } from "@/lib/use-result-timer"
import type { DisputeCategoryValue } from "@/lib/labels/dispute"
import { type ReasonValue } from "@/components/ui/reason-picker"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { useCopy } from "@/lib/clipboard"
import {
  durationHoursParts,
  formatDateTime,
  formatDateTimeWIB,
  formatDurationWords,
  formatRupiah,
} from "@/lib/format"
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
import { ORDER_STATUS_LABELS, OrderStatusBadge } from "@/components/ui/order-status-badge"
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
import { ShippingInfoCard } from "@/components/ui/shipping-info-card"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"

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
    /** G-08: masih ada halaman riwayat berikutnya? */
    historyHasMore: boolean
    /** R2 (butir #50): halaman riwayat yang sudah termuat (muat-awal = 1). */
    historyPage: number
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
      // A-12 (audit escrow 2026-09-24): inferensi dari USERNAME DIHAPUS —
      // username bisa berubah setelah order dibuat sehingga peran tertukar dan
      // tombol aksi pihak salah menyala. Fallback hanya cocokkan `me.id`;
      // tidak ketemu → `undefined` dan layar menyembunyikan aksi (`knownRole`).
      const role =
        o.myRole ??
        (me?.id && o.buyer?.id === me.id
          ? "BUYER"
          : me?.id && o.seller?.id === me.id
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
      return {
        order: resolvedOrder,
        history: h?.data ?? [],
        // G-08: halaman berikutnya ada bila meta.totalPages bilang begitu;
        // tanpa meta, halaman penuh = kemungkinan masih ada.
        historyHasMore: h?.meta?.totalPages != null ? h.meta.totalPages > 1 : (h?.data?.length ?? 0) >= HISTORY_LIMIT,
        historyPage: 1,
        durations: d,
        fee,
      }
    },
    Boolean(id),
  )
  const order = query.data?.order ?? null
  // R2 (audit ronde-2, butir #21): status pihak lawan (bayar/kirim/konfirmasi)
  // menyegar otomatis tiap 15 detik selama layar terbuka — tanpa pull-to-
  // refresh. Order status terminal berhenti dipoll. Galat ditelan oleh
  // useApiQuery (masuk state error), callback ini tidak melempar.
  // R2 #108: status terminal dipusatkan pada satu konstanta (dipakai polling
  // stop DAN pintasan riwayat terminal di fetcher).
  usePolling(
    async () => {
      await query.refresh().catch(() => {})
    },
    15_000,
    Boolean(id && order && !ORDER_TERMINAL_STATUSES.includes(order.status)),
  )
  const history = query.data?.history ?? []
  const historyHasMore = query.data?.historyHasMore ?? false
  const durations = query.data?.durations ?? null
  const fee = query.data?.fee ?? null
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
  // R2 (audit ronde-2, butir #17): kunci untuk "Tandai selesai" (rilis escrow);
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
    qrisPayment.reset()
  }, [qrisPayment])

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
        : parts.unit === "day"
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
  /**
   * Countdown auto-release dana (IN_DELIVERY + `autoCompleteAt` dari backend).
   * Detak 1-Hz bersama via `useClockTick` (aktif hanya selama kartu tampil)
   * dan jam server (E-03/F-13) agar perangkat dengan jam meleset tidak melihat
   * hitungan yang salah. Hook di sini (sebelum early return) — lihat J-14.
   */
  const autoReleaseTicking = order?.status === "IN_DELIVERY" && !!order?.autoCompleteAt
  const nowMs = useClockTick(autoReleaseTicking)
  const autoRelease = useMemo(() => {
    if (!order || order.status !== "IN_DELIVERY" || !order.autoCompleteAt) return null
    const target = new Date(order.autoCompleteAt).getTime()
    if (!Number.isFinite(target)) return null
    return {
      at: order.autoCompleteAt,
      secondsLeft: Math.max(0, Math.floor((target - nowMs) / 1000)),
    }
  }, [order, nowMs])
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
   * M-29 (audit end-to-end, issue #22): `canProcess` MEMAKAI `rawStatus`
   * (pra-alias) — normalisasi mengubah "PAID" → "PROCESSING" (A-08), sehingga
   * `order.status === "PAID"` mustahil true dan tombol "Mulai proses" tidak
   * pernah muncul. Dengan `rawStatus === "PAID"` gerbang legacy hidup lagi
   * TANPA mengubah tampilan status. `canShip` MENGEKUALIKAN `rawStatus !==
   * "PAID"` — kalau tidak, dua tombol ("Mulai proses" DAN "Isi resi") muncul
   * bersamaan untuk order yang sama.
   */
  const canPay = (order.status === "WAITING_PAYMENT" || order.status === "PENDING_PAYMENT") && isBuyer
  const canConfirm = order.status === "WAITING_CONFIRMATION" && isSeller
  const canProcess = order.rawStatus === "PAID" && isSeller
  const canShip = order.status === "PROCESSING" && order.rawStatus !== "PAID" && isSeller
  const canReviewDelivery =
    (order.status === "IN_DELIVERY" ||
      order.status === "SHIPPED" ||
      order.status === "DELIVERED") &&
    isBuyer
  // F6 (audit 2026-09-26): jangan tampilkan ajakan menilai bila user sudah menilai —
  // field `rated`/`isRated` sudah dinormalisasi dari payload order.
  const alreadyRated = order.rated === true || order.isRated === true
  const canRate = knownRole && order.status === "COMPLETED" && !alreadyRated
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
              // B-01 (audit escrow 2026-09-24): teruskan angka FINAL server —
              // dulu kartu menghitung ulang lokal sehingga angka kartu bisa
              // berbeda dari tombol "Bayar".
              buyerPays={fee.buyerPays}
              sellerGets={fee.sellerReceives}
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
              <View className="gap-1">
                <Text variant="caption" tone="secondary">
                  Transaksi selesai — ulasanmu membantu pengguna lain memutuskan.
                </Text>
                {/* F9 (audit 2026-09-26): komunikasikan jendela ulasan 7 hari
                    (RATING_WINDOW_DAYS backend) agar user tidak mengira tombol
                    "Ulas sekarang" tersedia selamanya. */}
                <Text variant="caption" tone="secondary">
                  {translate("Ulasan dapat diberikan dalam 7 hari setelah transaksi selesai.")}
                </Text>
              </View>
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
            {/*
             * Countdown auto-release dana: IN_DELIVERY + `autoCompleteAt` dari
             * backend (= deliveryDeadlineAt). Dana cair otomatis bila tidak
             * ada konfirmasi/sengketa sebelum tanggal tersebut.
             */}
            {autoRelease ? (
              <View className="gap-1 rounded-lg bg-warning-soft p-3">
                <Text variant="body" weight={600}>
                  {autoRelease.secondsLeft > 0
                    ? translate("Dana akan cair otomatis dalam {x}.", {
                        x: formatDurationWords(autoRelease.secondsLeft),
                      })
                    : translate("Dana akan segera diteruskan ke penjual.")}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate(
                    "Jika tidak ada konfirmasi atau sengketa sebelum {x}, dana otomatis diteruskan ke penjual.",
                    { x: formatDateTimeWIB(autoRelease.at) },
                  )}
                </Text>
              </View>
            ) : null}
            {canPay ? (
              <>
                {!fee || fee.buyerPays == null ? (
                  <ErrorState
                    compact
                    title="Rincian biaya belum tersedia"
                    description="Muat ulang untuk menampilkan jumlah yang harus dibayar."
                    onRetry={() => void query.reload()}
                  />
                ) : null}
                {/* M-30 (audit end-to-end, issue #91): tombol Bayar terkunci
                    SELAMA nominal belum terlihat — dulu `disabled={!fee}` tetap
                    mengizinkan bayar saat `fee` ada tapi `buyerPays` kosong
                    (label "Bayar —" = membayar tanpa nominal terlihat). */}
                <Button disabled={!fee || fee.buyerPays == null} onPress={() => setSheet("pay")}>
                  {/* B-05 (audit escrow 2026-09-24): label tidak pernah mencetak
                      `orderValue` sebagai total bayar (tanpa fee/diskon) — saat
                      fee belum terhitung tampil "—", bukan angka yang lebih kecil. */}
                  Bayar {fee?.buyerPays != null ? formatRupiah(fee.buyerPays) : "—"}
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
                      async () => {
                        // M-28 (audit end-to-end, issue #23-25): spesifikasi
                        // `POST /v1/orders/{id}/complete` TANPA requestBody —
                        // jejak bukti melekat pada order di sisi server. Komentar
                        // A-13 lama (mengklaim `ConfirmDeliveryDto` dipakai di
                        // sini) MENYESATKAN dan menghasilkan panggilan
                        // `completeOrder(id, {proofId})` yang ditolak validator.
                        await api.orders.completeOrder(
                          order.id,
                          // R2 (audit ronde-2, butir #17): kunci idempotensi
                          // per siklus (pola payOrder di atas) — retry pasca-
                          // timeout tidak melepas dana dua kali di server yang
                          // mendukung header. Dibersihkan setelah SUKSES.
                          completeKeyRef.current ??
                            (completeKeyRef.current = createIdempotencyKey()),
                        )
                        completeKeyRef.current = null
                      },
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
          <OrderSecondaryActions
            order={order}
            chatBusy={chatBusy}
            onOpenChat={() => void openChat()}
            canExtend={canExtend}
            isDisputed={isDisputed}
            canDispute={canDispute}
            canCancel={canCancel}
            submitting={submitting}
            onOpenSheet={(kind) => setSheet(kind)}
          />

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
          setPayMethod(v)
          setPinError(undefined)
        }}
        submitting={submitting}
        pinError={pinError}
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
      />

      <OrderPayProgressOverlay
        visible={payProgress !== null}
        state={payProgress ?? "PROCESSING"}
        feeBuyerPays={fee?.buyerPays}
        error={payProgressError}
      />
    </Screen>
  )
}
