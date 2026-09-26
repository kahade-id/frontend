/**
 * Admin — Order: daftar semua order + intervensi darurat escrow.
 *
 * - Filter status + pencarian (orderId / judul).
 * - Tap baris → BottomSheet detail: pihak pembeli/penjual, nominal,
 *   status escrow (dari transaksi ORDER_LOCK/ORDER_RELEASE/ORDER_REFUND),
 *   timeline ringkas dari riwayat status.
 * - Tombol darurat "Paksa batal" / "Paksa selesai": konfirmasi GANDA —
 *   BottomSheet wajib isi alasan (min 10 karakter) lalu dialog Alert
 *   konfirmasi. Ini intervensi escrow: backend idempoten
 *   (Idempotency-Key per request) + tombol dikunci selama request.
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { Package } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import {
  forceCancelOrder,
  forceCompleteOrder,
  getAdminOrderDetail,
  listAdminOrders,
  type AdminOrderDetail,
  type AdminOrderItem,
  type AdminOrderStatus,
} from "@/lib/api/admin/orders"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, string> = {
  WAITING_CONFIRMATION: "Menunggu konfirmasi",
  WAITING_PAYMENT: "Menunggu pembayaran",
  PROCESSING: "Diproses",
  IN_DELIVERY: "Dikirim",
  COMPLETED: "Selesai",
  DISPUTED: "Disengketakan",
  CANCELLED: "Dibatalkan",
}

const STATUS_TONE: Record<string, BadgeTone> = {
  WAITING_CONFIRMATION: "warning",
  WAITING_PAYMENT: "warning",
  PROCESSING: "info",
  IN_DELIVERY: "info",
  COMPLETED: "success",
  DISPUTED: "danger",
  CANCELLED: "neutral",
}

const STATUS_FILTERS: Array<{ value?: AdminOrderStatus; label: string }> = [
  { label: "Semua" },
  { value: "PROCESSING", label: "Diproses" },
  { value: "IN_DELIVERY", label: "Dikirim" },
  { value: "DISPUTED", label: "Disengketakan" },
  { value: "WAITING_PAYMENT", label: "Menunggu bayar" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
]

/** Status escrow diturunkan dari transaksi wallet order (urutan terbaru). */
function escrowStateOf(detail: AdminOrderDetail): {
  label: string
  tone: BadgeTone
} {
  const txs = detail.walletTransactions ?? []
  const relevant = txs.find((t) =>
    ["ORDER_LOCK", "ORDER_RELEASE", "ORDER_REFUND", "DISPUTE_RELEASE"].includes(
      String(t.type),
    ),
  )
  switch (String(relevant?.type)) {
    case "ORDER_LOCK":
      return { label: translate("Escrow terkunci"), tone: "warning" }
    case "ORDER_RELEASE":
      return { label: translate("Escrow cair"), tone: "success" }
    case "ORDER_REFUND":
      return { label: translate("Escrow refund"), tone: "info" }
    case "DISPUTE_RELEASE":
      return { label: translate("Cair via sengketa"), tone: "info" }
    default:
      return { label: translate("Tanpa escrow"), tone: "neutral" }
  }
}

const CANCELLABLE: AdminOrderStatus[] = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PROCESSING",
  "IN_DELIVERY",
  "DISPUTED",
]
const COMPLETABLE: AdminOrderStatus[] = ["PROCESSING", "IN_DELIVERY"]

export default function AdminOrdersScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | undefined>(
    undefined,
  )
  const [search, setSearch] = useState("")

  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [forceAction, setForceAction] = useState<"cancel" | "complete" | null>(
    null,
  )
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await listAdminOrders({
          page: 1,
          limit: PAGE_SIZE,
          status: statusFilter,
          q: search || undefined,
        })
        setOrders(res.data)
        setTotal(res.total ?? res.data.length)
        setPage(1)
      } catch (err) {
        setError(userMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [statusFilter, search],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const openDetail = useCallback(
    async (order: AdminOrderItem) => {
      setSheetOpen(true)
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      setForceAction(null)
      setReason("")
      setReasonError(null)
      try {
        const d = await getAdminOrderDetail(order.orderId || order.id)
        setDetail(d)
      } catch (err) {
        setDetailError(userMessage(err))
      } finally {
        setDetailLoading(false)
      }
    },
    [],
  )

  const closeDetail = useCallback(() => {
    if (submitting) return
    setSheetOpen(false)
    setDetail(null)
    setForceAction(null)
  }, [submitting])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || orders.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listAdminOrders({
        page: page + 1,
        limit: PAGE_SIZE,
        status: statusFilter,
        q: search || undefined,
      })
      setOrders((prev) => [...prev, ...res.data])
      setTotal(res.total ?? total)
      setPage((p) => p + 1)
    } catch (err) {
      toast.show({
        title: translate("Gagal memuat order"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, orders.length, total, page, statusFilter, search, toast])

  /** Konfirmasi ganda: BottomSheet (alasan) → Alert native. */
  const confirmForceAction = useCallback(() => {
    if (!detail || !forceAction || submitting) return
    const trimmed = reason.trim()
    if (trimmed.length < 10) {
      setReasonError(translate("Alasan minimal 10 karakter."))
      return
    }
    const isCancel = forceAction === "cancel"
    Alert.alert(
      translate(isCancel ? "Paksa batalkan order?" : "Paksa selesaikan order?"),
      translate(
        isCancel
          ? "Order akan dibatalkan dan escrow (bila ada) dikembalikan. Tindakan ini tidak bisa dibatalkan."
          : "Order akan diselesaikan dan escrow dicairkan ke penjual. Tindakan ini tidak bisa dibatalkan.",
      ),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate(isCancel ? "Ya, batalkan" : "Ya, selesaikan"),
          style: "destructive",
          onPress: () => void (async () => {
            setSubmitting(true)
            try {
              const res = isCancel
                ? await forceCancelOrder(detail.orderId, trimmed)
                : await forceCompleteOrder(detail.orderId, trimmed)
              toast.show({
                title: translate(
                  isCancel ? "Order dibatalkan" : "Order diselesaikan",
                ),
                description: detail.orderId,
                tone: "success",
              })
              setSheetOpen(false)
              setDetail(null)
              setForceAction(null)
              await load("refresh")
              void res
            } catch (err) {
              toast.show({
                title: translate("Gagal memproses order"),
                description: userMessage(err),
                tone: "danger",
              })
            } finally {
              setSubmitting(false)
            }
          })(),
        },
      ],
    )
  }, [detail, forceAction, submitting, reason, toast, load])

  const detailStatus = detail ? String(detail.status) : ""
  const canCancel =
    detail != null && (CANCELLABLE as string[]).includes(detailStatus)
  const canComplete =
    detail != null && (COMPLETABLE as string[]).includes(detailStatus)
  const escrow = detail ? escrowStateOf(detail) : null

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Order")} />
      <PullToRefresh
        onRefresh={() => load("refresh")}
        refreshing={refreshing}
        contentContainerClassName="px-5"
      >
        {loading ? (
          <LoadingScreen message={translate("Memuat order…")} />
        ) : error ? (
          <ErrorState
            title={translate("Gagal memuat order")}
            description={error}
            onRetry={() => load("initial")}
          />
        ) : (
          <View className="gap-3 pb-8 pt-3">
            <DebouncedSearchField
              placeholder={translate("Cari orderId / judul…")}
              initialQuery={search}
              onQueryChange={setSearch}
              accessibilityLabel={translate("Cari order")}
            />
            <View className="flex-row flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <Chip
                  key={f.label}
                  selected={statusFilter === f.value}
                  onPress={() => setStatusFilter(f.value)}
                  accessibilityLabel={translate("Filter {x}", {
                    x: f.label,
                  })}
                >
                  {translate(f.label)}
                </Chip>
              ))}
            </View>
            {orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title={translate("Belum ada order")}
                description={translate(
                  "Tidak ada order pada filter & pencarian ini.",
                )}
                compact
              />
            ) : (
              <View className="gap-2 mt-1">
                {orders.map((o) => (
                  <Card
                    key={o.id}
                    padded={false}
                    className="px-4 py-3"
                    onPress={() => void openDetail(o)}
                    accessibilityLabel={translate("Lihat detail order {x}", {
                      x: o.orderId,
                    })}
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1">
                        <Text variant="body" weight={600} numberOfLines={1}>
                          {o.title ?? o.orderId}
                        </Text>
                        <Text variant="caption" tone="secondary" className="mt-0.5">
                          {o.orderId} • {formatDateTimeWIB(o.createdAt)}
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <Text variant="body" weight={700}>
                          {formatRupiah(o.orderValue)}
                        </Text>
                        <Badge tone={STATUS_TONE[String(o.status)] ?? "neutral"}>
                          {translate(STATUS_LABEL[String(o.status)] ?? String(o.status))}
                        </Badge>
                      </View>
                    </View>
                  </Card>
                ))}
                {orders.length < total ? (
                  <Button
                    variant="secondary"
                    loading={loadingMore}
                    onPress={() => void handleLoadMore()}
                    className="mt-1"
                  >
                    {translate("Muat lebih banyak")}
                  </Button>
                ) : null}
              </View>
            )}
          </View>
        )}
      </PullToRefresh>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={closeDetail}
        title={translate("Detail order")}
        description={detail?.orderId}
        footer={
          detail && !detailLoading && !detailError && forceAction ? (
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={submitting}
                onPress={() => {
                  setForceAction(null)
                  setReason("")
                  setReasonError(null)
                }}
              >
                {translate("Batal")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                loading={submitting}
                onPress={confirmForceAction}
              >
                {translate("Lanjut")}
              </Button>
            </View>
          ) : undefined
        }
      >
        {detailLoading ? (
          <LoadingScreen message={translate("Memuat detail order…")} />
        ) : detailError ? (
          <ErrorState
            title={translate("Gagal memuat detail")}
            description={detailError}
            compact
          />
        ) : detail ? (
          <View className="gap-4">
            <View className="flex-row flex-wrap gap-2">
              <Badge tone={STATUS_TONE[detailStatus] ?? "neutral"}>
                {translate(STATUS_LABEL[detailStatus] ?? detailStatus)}
              </Badge>
              {escrow ? <Badge tone={escrow.tone}>{escrow.label}</Badge> : null}
              {detail.dispute ? (
                <Badge tone="danger">{translate("Ada sengketa")}</Badge>
              ) : null}
            </View>

            <View className="gap-1">
              <Text variant="h3">{formatRupiah(detail.orderValue)}</Text>
              <Text variant="caption" tone="secondary">
                {translate("Bayar pembeli")}: {formatRupiah(detail.buyerPayAmount ?? 0)}
                {" • "}
                {translate("Terima penjual")}: {formatRupiah(detail.sellerReceiveAmount ?? 0)}
              </Text>
            </View>

            <View className="gap-2">
              <PartyRow
                label={translate("Pembeli")}
                name={detail.buyer?.fullName ?? detail.buyer?.username}
                email={detail.buyer?.email}
              />
              <PartyRow
                label={translate("Penjual")}
                name={detail.seller?.fullName ?? detail.seller?.username}
                email={detail.seller?.email}
              />
            </View>

            {(detail.statusHistories?.length ?? 0) > 0 ? (
              <View className="gap-1.5">
                <Text variant="label" tone="secondary">
                  {translate("Timeline").toUpperCase()}
                </Text>
                {detail.statusHistories!.map((h, i) => (
                  <View key={i} className="flex-row gap-2 items-start">
                    <View className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <View className="flex-1">
                      <Text variant="body">
                        {translate(
                          STATUS_LABEL[String(h.status)] ?? String(h.status ?? "—"),
                        )}
                      </Text>
                      {h.createdAt ? (
                        <Text variant="caption" tone="secondary">
                          {formatDateTimeWIB(String(h.createdAt))}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {!forceAction ? (
              <View className="gap-2 mt-1">
                <Text variant="label" tone="danger">
                  {translate("INTERVENSI DARURAT").toUpperCase()}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate(
                    "Hanya dipakai saat alur normal macet. Setiap aksi tercatat di audit log.",
                  )}
                </Text>
                <View className="flex-row gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!canCancel}
                    onPress={() => setForceAction("cancel")}
                    accessibilityLabel={translate("Paksa batalkan order")}
                  >
                    {translate("Paksa batal")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={!canComplete}
                    onPress={() => setForceAction("complete")}
                    accessibilityLabel={translate("Paksa selesaikan order")}
                  >
                    {translate("Paksa selesai")}
                  </Button>
                </View>
                {!canCancel && !canComplete ? (
                  <Text variant="caption" tone="secondary">
                    {translate(
                      "Order pada status ini tidak bisa diintervensi (selesai/dibatalkan).",
                    )}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View className="gap-2 mt-1">
                <Text variant="body" weight={600} tone="danger">
                  {forceAction === "cancel"
                    ? translate("Paksa batal — tulis alasan")
                    : translate("Paksa selesai — tulis alasan")}
                </Text>
                <Input
                  label={translate("Alasan intervensi")}
                  required
                  multiline
                  numberOfLines={3}
                  value={reason}
                  onChangeText={(v) => {
                    setReason(v)
                    if (reasonError) setReasonError(null)
                  }}
                  errorText={reasonError ?? undefined}
                  placeholder={translate(
                    "Minimal 10 karakter, contoh: penjual tidak merespons 7 hari…",
                  )}
                  accessibilityLabel={translate("Alasan intervensi")}
                />
                <Text variant="caption" tone="secondary">
                  {translate(
                    "Setelah lanjut, akan ada dialog konfirmasi kedua.",
                  )}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}

function PartyRow({
  label,
  name,
  email,
}: {
  label: string
  name?: string | null
  email?: string | null
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="body" weight={500} className="text-right flex-1" numberOfLines={1}>
        {name ?? email ?? "—"}
      </Text>
    </View>
  )
}
